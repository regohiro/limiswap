import { Price, Token } from "@uniswap/sdk-core";
import { computePoolAddress, FeeAmount, Pool } from "@uniswap/v3-sdk";
import { ethers } from "hardhat";
import { IUniswapV3Pool, IUniswapV3Pool__factory } from "../abis/types";
import { LimiSwap__factory } from "../typechain";
import { fromBN, MacroChain, toWei } from "../utils";

const getState = async (
  pool: IUniswapV3Pool
) => {
  const [liquidty, slot0] = await Promise.all([
    pool.liquidity(),
    pool.slot0()
  ])
  return {
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    liquidty: liquidty.toString(),
    tick: slot0.tick
  }
}

const main = async () => {
  const { zero } = await MacroChain.init();
  const poolFees = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

  for(const poolFee of poolFees){
    const tokenA = new Token(42, "0x3f75B3d31a1ac8A35Ca2703B520686B90208105A", 18);
    const tokenB = new Token(42, "0x306A6C2C966EA2D3D724F079C420bCCf45c44584", 18);

    const addr = computePoolAddress({
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      tokenA,
      tokenB,
      fee: poolFee
    });

    console.log("Address: " + addr);

    const poolContract = IUniswapV3Pool__factory.connect(addr, zero);
    try {
      const { sqrtPriceX96, liquidty, tick } = await getState(poolContract);
      const { token0Price, token1Price } = new Pool(tokenA, tokenB, poolFee, sqrtPriceX96, liquidty, tick);
      console.log("Token0 Price: ");
      console.log(token0Price.toFixed(10));
      console.log("Token1 Price: ");
      console.log(token1Price.toFixed(10));
    } catch (err) {
      // console.error(err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  })

