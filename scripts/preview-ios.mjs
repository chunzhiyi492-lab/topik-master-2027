import { access, readFile } from 'node:fs/promises'
import { isIPv4 } from 'node:net'
import { join, resolve } from 'node:path'
import { preview } from 'vite'

const [host, certFile, keyFile, directory = 'dist'] = process.argv.slice(2)
if (!host || !certFile || !keyFile) {
  throw new Error('用法：node scripts/preview-ios.mjs <局域网 IPv4> <证书 PEM> <私钥 PEM> [构建目录]')
}
if (!isIPv4(host) || !/^(127\.0\.0\.1$|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)) {
  throw new Error('预览只允许绑定指定的内网地址或 127.0.0.1')
}

const outDir = resolve(directory)
await Promise.all(['index.html', 'sw.js'].map(asset => access(join(outDir, asset))))
const [cert, key] = await Promise.all([readFile(certFile), readFile(keyFile)])
const server = await preview({
  configFile: false,
  base: '/topik-master-2027/',
  build: { outDir },
  preview: { host, port: 4181, strictPort: true, https: { cert, key } },
})
server.printUrls()
