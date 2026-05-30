use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6gbTnghr3AXPbCTjieq3veCmt656ALbEd7VUGX9z5fFu");

#[program]
pub mod deadman_switch {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        beneficiary: Pubkey,
        interval: i64,
        amount: u64,
    ) -> Result<()> {
        require!(interval > 0, SwitchError::InvalidInterval);
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
            require!(interval > 0, SwitchError::InvalidInterval);
            switch.interval = interval;
        }

        emit!(ConfigUpdated {
            owner: switch.owner,
            beneficiary: switch.beneficiary,
            interval: switch.interval,
        });
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let switch = &ctx.accounts.switch;
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= switch.last_checkin + switch.interval,
            SwitchError::StillActive
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

#[account]
pub struct Switch {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub last_checkin: i64,
    pub interval: i64,
    pub amount: u64,
    pub bump: u8,
}

impl Switch {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 8 + 1;
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
    #[msg("Interval must be greater than zero")]
    InvalidInterval,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Beneficiary must differ from the owner")]
    InvalidBeneficiary,
}
