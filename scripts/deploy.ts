import { LimiSwap__factory, MockERC20__factory } from "../typechain";
import { MacroChain, toWei, verifyContract } from "../utils"

const main = async () => {
  const { deployer } = await MacroChain.init();

  //Deploy mock tokens
  const supply = toWei(1000000);
  await deployer<MockERC20__factory>("MockERC20", ["a", "A", supply], true);
  await deployer<MockERC20__factory>("MockERC20", ["b", "B", supply], true);

  //Deploy LimiSwap contract
  const keeper = "0x4Cb093f226983713164A62138C3F718A5b595F73";
  const router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  await deployer<LimiSwap__factory>("LimiSwap", [keeper, router], true);
}

main()
  .then(async () => await verifyContract("MockERC20", "LimiSwap"))
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })