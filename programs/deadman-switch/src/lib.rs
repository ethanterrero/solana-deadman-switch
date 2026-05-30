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

        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        ctx.accounts.switch.last_checkin = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let switch = &ctx.accounts.switch;
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= switch.last_checkin + switch.interval,
            SwitchError::StillActive
        );
        Ok(())
    }

    pub fn cancel(_ctx: Context<Cancel>) -> Result<()> {
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

#[error_code]
pub enum SwitchError {
    #[msg("Owner is still active; the check-in interval has not elapsed")]
    StillActive,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
}
