function getRandomWaitTime(min: any, max: any): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default getRandomWaitTime;

