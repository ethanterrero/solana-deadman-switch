use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu");

// Release builds use real-world bounds. The `demo` feature shrinks them to
// seconds so local tests and live demos can run the full lifecycle. Values are
// plain literals so the IDL carries numbers the frontend can read.

/// Shortest allowed check-in interval, in seconds.
#[cfg(not(feature = "demo"))]
#[constant]
pub const MIN_INTERVAL: i64 = 2_592_000; // 30 days
#[cfg(feature = "demo")]
#[constant]
pub const MIN_INTERVAL: i64 = 5;

/// Longest allowed check-in interval, in seconds.
#[constant]
pub const MAX_INTERVAL: i64 = 315_360_000; // 10 years

/// How long the owner has to veto a started claim, in seconds.
#[cfg(not(feature = "demo"))]
#[constant]
pub const CHALLENGE_PERIOD: i64 = 604_800; // 7 days
#[cfg(feature = "demo")]
#[constant]
pub const CHALLENGE_PERIOD: i64 = 10;

#[program]
pub mod deadman_switch {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        beneficiary: Pubkey,
        interval: i64,
        amount: u64,
    ) -> Result<()> {
        validate_interval(interval)?;
        require!(amount > 0, SwitchError::InvalidAmount);
        require_keys_neq!(
            beneficiary,
            ctx.accounts.owner.key(),
            SwitchError::InvalidBeneficiary
        );

        let now = Clock::get()?.unix_timestamp;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.switch.to_account_info(),
                },
            ),
            amount,
        )?;

        let switch = &mut ctx.accounts.switch;
        switch.owner = ctx.accounts.owner.key();
        switch.beneficiary = beneficiary;
        switch.last_checkin = now;
        switch.interval = interval;
        switch.amount = amount;
        switch.bump = ctx.bumps.switch;
        switch.claim_started_at = 0;

        emit!(SwitchInitialized {
            owner: switch.owner,
            beneficiary,
            interval,
            amount,
            last_checkin: now,
        });
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let switch = &mut ctx.accounts.switch;
        switch.last_checkin = now;
        veto_pending_claim(switch);

        emit!(CheckedIn {
            owner: switch.owner,
            last_checkin: now,
        });
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, SwitchError::InvalidAmount);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.switch.to_account_info(),
                },
            ),
            amount,
        )?;

        let switch = &mut ctx.accounts.switch;
        switch.amount = switch.amount.checked_add(amount).unwrap();

        emit!(Deposited {
            owner: switch.owner,
            amount,
            total: switch.amount,
        });
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_beneficiary: Option<Pubkey>,
        new_interval: Option<i64>,
    ) -> Result<()> {
        let owner = ctx.accounts.owner.key();
        let switch = &mut ctx.accounts.switch;

        if let Some(beneficiary) = new_beneficiary {
            require_keys_neq!(beneficiary, owner, SwitchError::InvalidBeneficiary);
            switch.beneficiary = beneficiary;
        }
        if let Some(interval) = new_interval {
            validate_interval(interval)?;
            switch.interval = interval;
        }
        // Any owner-signed change proves the owner is alive.
        veto_pending_claim(switch);

        emit!(ConfigUpdated {
            owner: switch.owner,
            beneficiary: switch.beneficiary,
            interval: switch.interval,
        });
        Ok(())
    }

    /// Phase one: once the owner misses their deadline, the beneficiary starts
    /// a claim. This opens a challenge window during which any check-in vetoes it.
    pub fn start_claim(ctx: Context<StartClaim>) -> Result<()> {
        let switch = &mut ctx.accounts.switch;
        let now = Clock::get()?.unix_timestamp;
        require!(switch.claim_started_at == 0, SwitchError::ClaimAlreadyStarted);
        let deadline = switch
            .last_checkin
            .checked_add(switch.interval)
            .ok_or(SwitchError::InvalidInterval)?;
        require!(now >= deadline, SwitchError::StillActive);

        switch.claim_started_at = now;

        emit!(ClaimStarted {
            owner: switch.owner,
            beneficiary: switch.beneficiary,
            claim_started_at: now,
            claimable_at: now + CHALLENGE_PERIOD,
        });
        Ok(())
    }

    /// Phase two: after the challenge window passes without a veto, the
    /// beneficiary receives the vault.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let switch = &ctx.accounts.switch;
        let now = Clock::get()?.unix_timestamp;
        require!(switch.claim_started_at != 0, SwitchError::ClaimNotStarted);
        require!(
            now >= switch.claim_started_at + CHALLENGE_PERIOD,
            SwitchError::ChallengeWindowOpen
        );

        emit!(Claimed {
            owner: switch.owner,
            beneficiary: switch.beneficiary,
            amount: switch.amount,
        });
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        emit!(Cancelled {
            owner: ctx.accounts.switch.owner,
        });
        Ok(())
    }
}

fn validate_interval(interval: i64) -> Result<()> {
    require!(
        (MIN_INTERVAL..=MAX_INTERVAL).contains(&interval),
        SwitchError::InvalidInterval
    );
    Ok(())
}

fn veto_pending_claim(switch: &mut Switch) {
    if switch.claim_started_at != 0 {
        switch.claim_started_at = 0;
        emit!(ClaimVetoed {
            owner: switch.owner,
            beneficiary: switch.beneficiary,
        });
    }
}

#[account]
pub struct Switch {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub last_checkin: i64,
    pub interval: i64,
    pub amount: u64,
    pub bump: u8,
    /// Unix time the beneficiary started a claim; 0 when no claim is pending.
    /// Appended last so earlier field offsets (and memcmp filters) are unchanged.
    pub claim_started_at: i64,
}

impl Switch {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 8 + 1 + 8;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Switch::LEN,
        seeds = [b"switch", owner.key().as_ref()],
        bump
    )]
    pub switch: Account<'info, Switch>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(
        mut,
        seeds = [b"switch", owner.key().as_ref()],
        bump = switch.bump,
        has_one = owner @ SwitchError::Unauthorized
    )]
    pub switch: Account<'info, Switch>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"switch", owner.key().as_ref()],
        bump = switch.bump,
        has_one = owner @ SwitchError::Unauthorized
    )]
    pub switch: Account<'info, Switch>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"switch", owner.key().as_ref()],
        bump = switch.bump,
        has_one = owner @ SwitchError::Unauthorized
    )]
    pub switch: Account<'info, Switch>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct StartClaim<'info> {
    #[account(
        mut,
        seeds = [b"switch", switch.owner.as_ref()],
        bump = switch.bump,
        has_one = beneficiary @ SwitchError::Unauthorized
    )]
    pub switch: Account<'info, Switch>,
    pub beneficiary: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"switch", switch.owner.as_ref()],
        bump = switch.bump,
        has_one = beneficiary @ SwitchError::Unauthorized,
        close = beneficiary
    )]
    pub switch: Account<'info, Switch>,
    #[account(mut)]
    pub beneficiary: Signer<'info>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        mut,
        seeds = [b"switch", owner.key().as_ref()],
        bump = switch.bump,
        has_one = owner @ SwitchError::Unauthorized,
        close = owner
    )]
    pub switch: Account<'info, Switch>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[event]
pub struct SwitchInitialized {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub interval: i64,
    pub amount: u64,
    pub last_checkin: i64,
}

#[event]
pub struct CheckedIn {
    pub owner: Pubkey,
    pub last_checkin: i64,
}

#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub amount: u64,
    pub total: u64,
}

#[event]
pub struct ConfigUpdated {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub interval: i64,
}

#[event]
pub struct ClaimStarted {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub claim_started_at: i64,
    pub claimable_at: i64,
}

#[event]
pub struct ClaimVetoed {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
}

#[event]
pub struct Claimed {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Cancelled {
    pub owner: Pubkey,
}

#[error_code]
pub enum SwitchError {
    #[msg("Owner is still active; the check-in interval has not elapsed")]
    StillActive,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Interval is outside the allowed range")]
    InvalidInterval,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Beneficiary must differ from the owner")]
    InvalidBeneficiary,
    #[msg("A claim is already pending for this vault")]
    ClaimAlreadyStarted,
    #[msg("No claim has been started; call start_claim first")]
    ClaimNotStarted,
    #[msg("The owner's challenge window is still open")]
    ChallengeWindowOpen,
}
