import { LimiSwap__factory,} from "../../typechain";
import { MacroChain, toWei, verifyContract } from "../../utils"

const main = async () => {
  const { deployer, users } = await MacroChain.init();

  //Deploy LimiSwap contract
  const keeper = users[1].address;
  const router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const quoter = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

  await deployer<LimiSwap__factory>("LimiSwap", [keeper, router, quoter], true);
}

main()
  .then(async () => await verifyContract("LimiSwap"))
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })