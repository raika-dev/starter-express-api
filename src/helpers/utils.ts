import MersenneTwister from "mersenne-twister";

const randGenerator = new MersenneTwister();

export const rand = (n: number) => {
  return randGenerator.random_int() % n;
}

export const setSeed = (seed?: number) => {
  if (!seed) seed = Number(new Date());
  randGenerator.init_seed(seed);
}

export const shuffledCards = () => {
  let cards: number[] = [];
  for (let i = 0; i < 52; i++) cards[i] = i + 1;
  for (let i = 51; i >= 0; i--) {
    let j = rand(i + 1);
    let tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards;
}
