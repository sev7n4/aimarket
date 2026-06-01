export const SIGN_DAILY_CREDITS = 10;
export const INVITE_REWARD_CREDITS = 100;
/** 集成/E2E 场景下提高注册赠送，便于跑完整 Skill 套餐 */
export const REGISTER_BONUS =
  process.env.E2E_RELAX_RATE_LIMIT === "true" ? 10_000 : 100;
