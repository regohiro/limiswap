import { ethers } from "ethers";
import { IERC20__factory, ISwapRouter__factory, LimiSwap__factory,} from "../../typechain";
import { ExactInputSingleParamsStruct } from "../../typechain/ISwapRouter";
import { MacroChain, toWei, verifyContract } from "../../utils"

const main = async () => {
  const { deployer, users, owner, zero } = await MacroChain.init();

  const limiswap = LimiSwap__factory.connect("0x79756737A51209dC4303e09f9CB0ABACEC41f058", owner);
  const swapRouter = ISwapRouter__factory.connect("0xE592427A0AEce92De3Edee1F18E0157C05861564", owner);
  const tokenA = IERC20__factory.connect("0xEB0583F123dede6Ce3e330f8AD6BFe27B2Ecef36", owner);
  const tokenB = IERC20__factory.connect("0xf38a339f99b0ac70fB769Cffe36ff371B2608f70", owner);
  const feeAB = 3000;

  //Make limit order
  {
    const price = toWei(100);
    const amountIn = toWei(1.5);
    const tokenIn = tokenA.address;
    const tokenOut = tokenB.address;
    const slippage = 10000;

    await tokenA.approve(limiswap.address, amountIn);
    //Creates A => B limit order of when A : B = 1 : 100
    await limiswap.createOrder(price, amountIn, tokenIn, tokenOut, feeAB, slippage);
  }

  //Manipulate price
  {
    const amountIn = toWei(100);
    const deadline = (await limiswap.getTime()) + 100;

    const params: ExactInputSingleParamsStruct = {
      tokenIn: tokenB.address,
      tokenOut: tokenA.address,
      fee: feeAB,
      recipient: owner.address,
      deadline,
      amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    };

    await swapRouter.exactInputSingle(params, {
      gasLimit: 200000,
      maxFeePerGas: toWei(5, 9),
      maxPriorityFeePerGas: toWei(5, 9),
    });
  }

  //Check if target has reached
  {
    const res = await limiswap.connect(zero).callStatic.checkUpkeep("0x");

    const upkeepNeeded = res[0];
    console.log("upKeepNeeded: " + upkeepNeeded);

    if(upkeepNeeded){
      const index = ethers.utils.defaultAbiCoder.decode(["uint"], res[1]);
      console.log("index: " + index);

      await limiswap.connect(users[1]).performUpkeep(res[1]);
    }
  }
}

main()
  .then(async () => await verifyContract("LimiSwap"))
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })