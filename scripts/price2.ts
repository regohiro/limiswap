import { Price, Token } from "@uniswap/sdk-core";
import { computePoolAddress, FeeAmount, Pool, SwapQuoter } from "@uniswap/v3-sdk";
import { ethers } from "hardhat";
import { IUniswapV3Pool, IUniswapV3Pool__factory } from "../abis/types";
import { LimiSwap__factory } from "../typechain";
import { fromBN, MacroChain, toWei } from "../utils";

const getState = async (pool: IUniswapV3Pool) => {
  const [liquidty, slot0] = await Promise.all([pool.liquidity(), pool.slot0()]);
  return {
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    liquidty: liquidty.toString(),
    tick: slot0.tick,
  };
};

const main = async () => {
  const { zero } = await MacroChain.init();
  const tokenIn = "0x3f75B3d31a1ac8A35Ca2703B520686B90208105A";
  const tokenOut = "0x306A6C2C966EA2D3D724F079C420bCCf45c44584";
  const tokenA = new Token(42, tokenIn, 18);
  const tokenB = new Token(42, tokenOut, 18);
  const poolFees = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

  console.log("s");
  const pending = poolFees.map(async (poolFee) => {
    const poolAddr = computePoolAddress({
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      tokenA,
      tokenB,
      fee: poolFee,
    });
    try {
      const { sqrtPriceX96, liquidty, tick } = await getState(IUniswapV3Pool__factory.connect(poolAddr, zero))
      const pool = new Pool(tokenA, tokenB, poolFee, sqrtPriceX96, liquidty, tick);
      return {
        poolFee,
        token0Price: pool.token0Price,
        token1Price: pool.token1Price,
      }
    } catch (err) {
      throw err;
    }
  }).map(p => p.catch(e => e));

  try {
    const result = await Promise.all(pending);
  } catch(err: any) {
    console.error(err);
  }
  console.log("e");
};

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
