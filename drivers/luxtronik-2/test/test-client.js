'use strict';

const LuxtronikClient = require('../lib/LuxtronikClient');

async function main() {

  const client = new LuxtronikClient('192.168.180.10');

  console.log('Reading calculated values...');

  const calculated = await client.readCalculated();

  console.log(calculated);

}

main().catch(console.error);