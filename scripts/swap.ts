import { ethers } from "hardhat";
import { IERC20__factory, ISwapRouter__factory } from "../typechain";
import { ExactInputSingleParamsStruct } from "../typechain/ISwapRouter";
import { fromBN, MacroChain, toBN, toWei } from "../utils";

const main = async () => {
  const { owner } = await MacroChain.init();

  // console.log(owner.address);
  // console.log(fromBN(await ethers.provider.getBalance(owner.address)));

  const tokenA = IERC20__factory.connect("0x3f75B3d31a1ac8A35Ca2703B520686B90208105A", owner);
  const tokenB = IERC20__factory.connect("0x306A6C2C966EA2D3D724F079C420bCCf45c44584", owner);
  const swapRouter = ISwapRouter__factory.connect("0xE592427A0AEce92De3Edee1F18E0157C05861564", owner);

  // console.log(fromBN(await tokenB.balanceOf(owner.address)));

  const amountIn = toWei(1);
  const fee = 3000;

  // await tokenB.approve(swapRouter.address, amountIn);

  const params: ExactInputSingleParamsStruct = {
    tokenIn: tokenB.address,
    tokenOut: tokenA.address,
    fee,
    recipient: owner.address,
    deadline: 1637983408,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  const tx = await swapRouter.exactInputSingle(params, {
    gasLimit: 200000,
    maxFeePerGas: toWei(5, 9),
    maxPriorityFeePerGas: toWei(5, 9),
  });

  // console.log(JSON.stringify(params, null, 2));

  // const tx = await swapRouter.exactInputSingle(params, {
  //   maxFeePerGas: toWei(5, 9),
  //   maxPriorityFeePerGas: toWei(5, 9),
  //   gasLimit: 200000,
  //   value: 0,
  // });

  const { transactionHash } = await tx.wait();
  console.log(transactionHash);
};

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
