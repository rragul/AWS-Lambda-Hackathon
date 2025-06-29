import { Redis } from "iovalkey";


const PORT= 6379;
const HOST= process.env.VALKEY_URL;

export const valKeyClient = new Redis({ port: PORT ,host: HOST,tls: {},});