import { BlockList, isIP } from 'node:net';

const blockedV4 = new BlockList();
for (const [ip, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blockedV4.addSubnet(ip, bits);
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [ip, bits] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  blockedV6.addSubnet(ip, bits, 'ipv6');
}

export function isPublicAddress(address: string) {
  switch (isIP(address)) {
    case 4: return !blockedV4.check(address);
    case 6: return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
    default: return false;
  }
}
