import { ethers } from "hardhat";
import { IERC20Metadata__factory, IQuoter__factory } from "../typechain";
import { fromBN, MacroChain, toBN, toWei } from "../utils";

const main = async () => {
  const { zero } = await MacroChain.init();
  const addr = "0xb27308f9f90d607463bb33ea1bebb41c27ce5ab6";
  const tokenInAddr = "0xc95b247049a8cc8e7f68bb6ffd9eee3c97769118";
  const tokenOutAddr = "0x3376d8cdcd1c6febaf41559a39a8acc91ad06a47";

  const quoter = IQuoter__factory.connect(addr, zero);
  const tokenInMetadata = IERC20Metadata__factory.connect(tokenInAddr, zero);
  const amoutIn = toBN(10).pow(await tokenInMetadata.decimals());

  console.log(amoutIn.toString());

  const amountOut = await quoter.callStatic.quoteExactInputSingle(
    tokenInAddr,
    tokenOutAddr,
    3000,
    amoutIn,
    0,
  );

  console.log(fromBN(amountOut));
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })

