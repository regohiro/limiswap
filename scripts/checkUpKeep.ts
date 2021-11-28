import { LimiSwap__factory } from "../typechain";
import { MacroChain } from "../utils";

const main = async () => {
  const { zero } = await MacroChain.init();
  const addr = "0xA798E15BF6c880c7125D7E6BB819BE461DB48d98";
  const limiswap = LimiSwap__factory.connect(addr, zero);
  const res = await limiswap.callStatic.checkUpkeep("0x");
  console.log(res);
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })
