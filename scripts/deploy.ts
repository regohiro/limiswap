import { LimiSwap__factory } from "../typechain";
import { MacroChain, verifyContract } from "../utils"

const main = async () => {
  const { deployer } = await MacroChain.init();

  const keeper = "0x4Cb093f226983713164A62138C3F718A5b595F73";
  const router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const quoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const weth = "0xd0A1E359811322d97991E03f863a0C30C2cF029C";

  await deployer<LimiSwap__factory>("LimiSwap", [keeper, router, quoter, weth], true);
}

main()
  .then(async () => await verifyContract("LimiSwap"))
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })