/**
 * DealFlow360 — Comprehensive Product Catalog Seed
 *
 * Adds 200 realistic B2B enterprise products across 10 categories
 * + 20 historical CONFIRMED quotations with multi-product lines
 *
 * Purpose: Bootstrap the co-purchase recommendation engine so it
 * surfaces meaningful, context-aware upsell/cross-sell suggestions.
 *
 * Run: npx tsx prisma/seed-catalog.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function calcLine(unitPrice: number, qty: number, discPct: number, taxRate: number) {
  const discountAmount = +(unitPrice * qty * (discPct / 100)).toFixed(2);
  const taxableAmount = unitPrice * qty - discountAmount;
  const taxAmount = +(taxableAmount * (taxRate / 100)).toFixed(2);
  const lineTotal = +taxableAmount.toFixed(2);
  const estimatedUnitCost = +(unitPrice * 0.6).toFixed(2);
  const estimatedMarginAmount = +((unitPrice - estimatedUnitCost) * qty - discountAmount).toFixed(2);
  const estimatedMarginPercent = lineTotal > 0 ? +((estimatedMarginAmount / lineTotal) * 100).toFixed(4) : 0;
  return { discountAmount, taxAmount, lineTotal, estimatedUnitCost, estimatedMarginAmount, estimatedMarginPercent };
}

async function main() {
  console.log('🌱 Starting comprehensive catalog seed...');

  const rep = await prisma.user.findUnique({ where: { email: 'rep@demo.com' } });
  const acme = await prisma.customer.findUnique({ where: { name: 'Acme Corp' } });
  const beta = await prisma.customer.findUnique({ where: { name: 'Beta Industries' } });

  if (!rep || !acme || !beta) {
    throw new Error('Run the base seed (prisma/seed.ts) first — users/customers not found.');
  }

  // ── 1. Categories ──────────────────────────────────────────────────────────
  console.log('  → Categories...');
  const [catLaptops, catServers, catNetwork, catMonitors, catPeripherals,
         catServices, catCloud, catSecurity, catAV, catPower] = await Promise.all([
    prisma.category.upsert({ where: { name: 'Laptops & Workstations' }, update: {}, create: { name: 'Laptops & Workstations', description: 'Business laptops, desktops, and workstations' } }),
    prisma.category.upsert({ where: { name: 'Servers & Storage' }, update: {}, create: { name: 'Servers & Storage', description: 'Rack servers, NAS, SAN, and storage media' } }),
    prisma.category.upsert({ where: { name: 'Networking Equipment' }, update: {}, create: { name: 'Networking Equipment', description: 'Switches, routers, access points, and firewalls' } }),
    prisma.category.upsert({ where: { name: 'Monitors & Displays' }, update: {}, create: { name: 'Monitors & Displays', description: 'Business monitors, large-format displays, and projectors' } }),
    prisma.category.upsert({ where: { name: 'Peripherals & Accessories' }, update: {}, create: { name: 'Peripherals & Accessories', description: 'Keyboards, mice, webcams, headsets, docks, and accessories' } }),
    prisma.category.upsert({ where: { name: 'Professional Services' }, update: {}, create: { name: 'Professional Services', description: 'IT setup, consulting, training, and managed services' } }),
    prisma.category.upsert({ where: { name: 'Cloud Software Subscriptions' }, update: {}, create: { name: 'Cloud Software Subscriptions', description: 'SaaS, cloud platforms, and recurring software licenses' } }),
    prisma.category.upsert({ where: { name: 'Security Solutions' }, update: {}, create: { name: 'Security Solutions', description: 'Physical security, cybersecurity hardware, and access control' } }),
    prisma.category.upsert({ where: { name: 'Audio/Video & Conferencing' }, update: {}, create: { name: 'Audio/Video & Conferencing', description: 'Conference cameras, speakerphones, whiteboards, and AV equipment' } }),
    prisma.category.upsert({ where: { name: 'Power & Infrastructure' }, update: {}, create: { name: 'Power & Infrastructure', description: 'UPS systems, server cabinets, PDUs, and data center infrastructure' } }),
  ]);

  // ── 2. Category Discount Ceilings ─────────────────────────────────────────
  console.log('  → Category discount ceilings...');
  for (const c of [
    { categoryId: catLaptops.id, maxDiscount: 15.0 },
    { categoryId: catServers.id, maxDiscount: 12.0 },
    { categoryId: catNetwork.id, maxDiscount: 12.0 },
    { categoryId: catMonitors.id, maxDiscount: 15.0 },
    { categoryId: catPeripherals.id, maxDiscount: 20.0 },
    { categoryId: catServices.id, maxDiscount: 10.0 },
    { categoryId: catCloud.id, maxDiscount: 12.0 },
    { categoryId: catSecurity.id, maxDiscount: 10.0 },
    { categoryId: catAV.id, maxDiscount: 12.0 },
    { categoryId: catPower.id, maxDiscount: 10.0 },
  ]) {
    await prisma.categoryDiscountCeiling.upsert({ where: { categoryId: c.categoryId }, update: { maxDiscount: c.maxDiscount }, create: c });
  }

  // ── 3. Products ────────────────────────────────────────────────────────────
  console.log('  → Products...');
  const productDefs: Array<{
    sku: string; name: string; categoryId: string; unit: string;
    basePrice: number; taxRate: number; isSubscription: boolean;
    recurringInterval?: string; description?: string;
  }> = [
    // Laptops & Workstations (25)
    { sku: 'LW-BIZ-14-01',   name: 'Business Laptop 14" Core i5',       categoryId: catLaptops.id, unit: 'unit',          basePrice: 899,   taxRate: 8, isSubscription: false, description: '14" FHD IPS, Intel Core i5-1235U, 8GB RAM, 256GB SSD' },
    { sku: 'LW-BIZ-15-02',   name: 'Business Laptop 15" Core i7',        categoryId: catLaptops.id, unit: 'unit',          basePrice: 1099,  taxRate: 8, isSubscription: false, description: '15.6" FHD, Intel Core i7-1355U, 16GB RAM, 512GB SSD' },
    { sku: 'LW-PRO-16-03',   name: 'Laptop Pro 16" i9 OLED',             categoryId: catLaptops.id, unit: 'unit',          basePrice: 1899,  taxRate: 8, isSubscription: false, description: '16" QHD+ OLED, Intel Core i9-13900H, 32GB RAM, 1TB NVMe' },
    { sku: 'LW-SLIM-14-04',  name: 'UltraSlim Laptop 14" Evo',           categoryId: catLaptops.id, unit: 'unit',          basePrice: 1299,  taxRate: 8, isSubscription: false, description: '14" 2.8K OLED, Intel Evo, 16GB LPDDR5, 512GB SSD, 1.2kg' },
    { sku: 'LW-MBIZ-15-05',  name: 'Mobile Workstation 15.6" Xeon',      categoryId: catLaptops.id, unit: 'unit',          basePrice: 2199,  taxRate: 8, isSubscription: false, description: '15.6" 4K, Intel Xeon, NVIDIA RTX A2000, 32GB ECC RAM' },
    { sku: 'LW-2IN1-13-06',  name: '2-in-1 Convertible 13" Touch',       categoryId: catLaptops.id, unit: 'unit',          basePrice: 1099,  taxRate: 8, isSubscription: false, description: '13.3" FHD Touch, Intel Core i5, 8GB RAM, 256GB SSD' },
    { sku: 'LW-CHRM-14-07',  name: 'Chromebook Enterprise 14"',          categoryId: catLaptops.id, unit: 'unit',          basePrice: 649,   taxRate: 8, isSubscription: false, description: '14" FHD, Intel Celeron N4500, 4GB RAM, 64GB eMMC, Chrome OS' },
    { sku: 'LW-DOCK-01-08',  name: 'Laptop Docking Station USB-C 90W',   categoryId: catLaptops.id, unit: 'unit',          basePrice: 199,   taxRate: 8, isSubscription: false, description: 'USB-C Dock, 2x HDMI, 4x USB-A, Ethernet, 90W PD' },
    { sku: 'LW-STAND-01-09', name: 'Adjustable Laptop Stand Aluminum',   categoryId: catLaptops.id, unit: 'unit',          basePrice: 69,    taxRate: 8, isSubscription: false, description: 'Aluminum, 6 height levels, foldable, for 10-17" laptops' },
    { sku: 'LW-DT-I7-10',    name: 'Desktop PC Tower Core i7 Win11',     categoryId: catLaptops.id, unit: 'unit',          basePrice: 1199,  taxRate: 8, isSubscription: false, description: 'Intel Core i7-13700, 16GB DDR5, 512GB NVMe + 1TB HDD, Win 11 Pro' },
    { sku: 'LW-AIO-24-11',   name: 'All-in-One Desktop 24" Core i5',     categoryId: catLaptops.id, unit: 'unit',          basePrice: 999,   taxRate: 8, isSubscription: false, description: '24" FHD IPS, Core i5, 8GB, 256GB SSD, Webcam, Win 11 Pro' },
    { sku: 'LW-MINI-01-12',  name: 'Mini PC Business Core i5',           categoryId: catLaptops.id, unit: 'unit',          basePrice: 499,   taxRate: 8, isSubscription: false, description: 'Intel Core i5, 8GB RAM, 256GB SSD, 4x USB, HDMI, DP' },
    { sku: 'LW-THIN-01-13',  name: 'Thin Client Terminal AMD',           categoryId: catLaptops.id, unit: 'unit',          basePrice: 299,   taxRate: 8, isSubscription: false, description: 'AMD Ryzen Embedded, 4GB, 32GB Flash, VDI ready, Wyse OS' },
    { sku: 'LW-BIZ-13-14',   name: 'Business Laptop 13" Ultralight',     categoryId: catLaptops.id, unit: 'unit',          basePrice: 979,   taxRate: 8, isSubscription: false, description: '13.3" FHD, i5-1235U, 8GB, 256GB SSD, 980g, 12-hr battery' },
    { sku: 'LW-WS-DT-15',    name: 'Desktop Workstation Dual Xeon',      categoryId: catLaptops.id, unit: 'unit',          basePrice: 3499,  taxRate: 8, isSubscription: false, description: 'Dual Intel Xeon Silver, 64GB ECC, NVIDIA Quadro RTX 4000' },
    { sku: 'LW-BAG-15-16',   name: 'Business Laptop Bag 15.6"',          categoryId: catLaptops.id, unit: 'unit',          basePrice: 59,    taxRate: 8, isSubscription: false, description: 'Water-resistant, padded compartments, TSA lock, carry-on size' },
    { sku: 'LW-SLEEVE-14-17',name: 'Laptop Sleeve 14" Neoprene',         categoryId: catLaptops.id, unit: 'unit',          basePrice: 29,    taxRate: 8, isSubscription: false, description: 'Water-resistant neoprene, fits 13-14" laptops' },
    { sku: 'LW-LOCK-01-18',  name: 'Laptop Security Lock Cable',         categoryId: catLaptops.id, unit: 'unit',          basePrice: 39,    taxRate: 8, isSubscription: false, description: 'Kensington-compatible, 1.8m, combination lock' },
    { sku: 'LW-WRIST-01-19', name: 'Ergonomic Wrist Rest Set Foam',      categoryId: catLaptops.id, unit: 'unit',          basePrice: 35,    taxRate: 8, isSubscription: false, description: 'Memory foam keyboard and mouse pad wrist rest combo' },
    { sku: 'LW-COOL-01-20',  name: 'Laptop Cooling Pad 5-Fan',           categoryId: catLaptops.id, unit: 'unit',          basePrice: 49,    taxRate: 8, isSubscription: false, description: '5 fans, 2 USB ports, adjustable height, for 15-17" laptops' },
    { sku: 'LW-PRO-14-21',   name: 'Laptop Pro 14" i7 OLED',             categoryId: catLaptops.id, unit: 'unit',          basePrice: 1599,  taxRate: 8, isSubscription: false, description: '14" 2.8K OLED, i7-13700H, 16GB LPDDR5, 1TB NVMe' },
    { sku: 'LW-BIZ-15-22',   name: 'Business Laptop 15" Ryzen 7',        categoryId: catLaptops.id, unit: 'unit',          basePrice: 1049,  taxRate: 8, isSubscription: false, description: '15.6" FHD IPS, AMD Ryzen 7 7730U, 16GB, 512GB SSD' },
    { sku: 'LW-REFURB-14-23',name: 'Certified Refurb Laptop 14" i5',     categoryId: catLaptops.id, unit: 'unit',          basePrice: 549,   taxRate: 8, isSubscription: false, description: 'Grade A refurb, Core i5 Gen 11, 8GB, 256GB SSD, 1-yr warranty' },
    { sku: 'LW-CHARGE-01-24',name: 'USB-C 140W GaN Charging Adapter',    categoryId: catLaptops.id, unit: 'unit',          basePrice: 89,    taxRate: 8, isSubscription: false, description: '140W GaN charger, 2x USB-C, 1x USB-A, foldable plug' },
    { sku: 'LW-PROT-01-25',  name: 'Laptop Screen Protector 15.6"',      categoryId: catLaptops.id, unit: 'unit',          basePrice: 19,    taxRate: 8, isSubscription: false, description: 'Anti-glare, 9H hardness, fits most 15.6" displays' },
    // Servers & Storage (20)
    { sku: 'SS-RACK1U-01',   name: 'Rack Server 1U Dual Xeon Silver',    categoryId: catServers.id,  unit: 'unit',          basePrice: 3499,  taxRate: 8, isSubscription: false, description: '2x Intel Xeon Silver 4310, 64GB DDR4 ECC, 2x 480GB SSD RAID1' },
    { sku: 'SS-RACK2U-02',   name: 'Rack Server 2U 8-Bay Storage',       categoryId: catServers.id,  unit: 'unit',          basePrice: 5499,  taxRate: 8, isSubscription: false, description: '2x Xeon Gold 5318, 128GB ECC, 8x 2TB SATA HDD bays, RAID' },
    { sku: 'SS-TOWER-03',    name: 'Tower Server Xeon E-2336',            categoryId: catServers.id,  unit: 'unit',          basePrice: 2799,  taxRate: 8, isSubscription: false, description: 'Intel Xeon E-2336, 16GB ECC, 2x 480GB SSD, iDRAC/iLO' },
    { sku: 'SS-NAS8-04',     name: 'NAS Storage 8-Bay Network',          categoryId: catServers.id,  unit: 'unit',          basePrice: 1299,  taxRate: 8, isSubscription: false, description: '8-bay, Intel Celeron, 4GB RAM, 2x GbE, expandable to 108TB' },
    { sku: 'SS-NAS4-05',     name: 'NAS Storage 4-Bay SOHO',             categoryId: catServers.id,  unit: 'unit',          basePrice: 699,   taxRate: 8, isSubscription: false, description: '4-bay, ARM quad-core, 2GB RAM, supports RAID 0/1/5/6/10' },
    { sku: 'SS-SAN-06',      name: 'SAN Storage Array 24-Bay Dual Ctrl', categoryId: catServers.id,  unit: 'unit',          basePrice: 12999, taxRate: 8, isSubscription: false, description: '24x SFF bays, dual controller, 16Gb FC, iSCSI, NVMe cache' },
    { sku: 'SS-HDD4TB-07',   name: 'Enterprise HDD 4TB 7200RPM SATA',   categoryId: catServers.id,  unit: 'unit',          basePrice: 179,   taxRate: 8, isSubscription: false, description: 'SATA III, 256MB cache, MTBF 2M hrs, 5-yr warranty, CMR' },
    { sku: 'SS-HDD8TB-08',   name: 'Enterprise HDD 8TB SATA',           categoryId: catServers.id,  unit: 'unit',          basePrice: 299,   taxRate: 8, isSubscription: false, description: 'SATA 6Gbps, 7200 RPM, 256MB cache, 5-yr warranty' },
    { sku: 'SS-SSD1T-09',    name: 'Enterprise SSD 1TB U.2 NVMe PCIe4', categoryId: catServers.id,  unit: 'unit',          basePrice: 249,   taxRate: 8, isSubscription: false, description: 'U.2 NVMe PCIe 4.0, 6800/4200 MB/s R/W, DWPD 3, 5-yr warranty' },
    { sku: 'SS-SSD2T-10',    name: 'Data Center SSD 2TB NVMe Gen4',     categoryId: catServers.id,  unit: 'unit',          basePrice: 449,   taxRate: 8, isSubscription: false, description: 'PCIe Gen4 NVMe, 7000 MB/s read, power-loss protection' },
    { sku: 'SS-RAM32-11',    name: 'Server RAM 32GB DDR4 ECC RDIMM',    categoryId: catServers.id,  unit: 'unit',          basePrice: 229,   taxRate: 8, isSubscription: false, description: '32GB DDR4-3200 ECC Registered, dual rank, server grade' },
    { sku: 'SS-RAM64-12',    name: 'Server RAM 64GB DDR4 ECC LRDIMM',   categoryId: catServers.id,  unit: 'unit',          basePrice: 449,   taxRate: 8, isSubscription: false, description: '64GB DDR4-3200 ECC Registered LRDIMM, high-density' },
    { sku: 'SS-RAID-13',     name: 'RAID Controller PCIe 8-Port SAS3',  categoryId: catServers.id,  unit: 'unit',          basePrice: 399,   taxRate: 8, isSubscription: false, description: 'SAS3/SATA3, 8 ports, RAID 0/1/5/6/10/50/60, 1GB flash cache' },
    { sku: 'SS-TAPE-14',     name: 'Tape Drive LTO-8 External USB+SAS', categoryId: catServers.id,  unit: 'unit',          basePrice: 1299,  taxRate: 8, isSubscription: false, description: 'LTO-8, 12TB native / 30TB compressed, USB 3.0 + SAS' },
    { sku: 'SS-HBA-15',      name: 'Fibre Channel HBA 16Gbps Dual-Port',categoryId: catServers.id,  unit: 'unit',          basePrice: 599,   taxRate: 8, isSubscription: false, description: 'Dual-port 16Gb FC, PCIe 3.0 x8, SAN connectivity' },
    { sku: 'SS-GPU-16',      name: 'GPU Accelerator NVIDIA A30 24GB',   categoryId: catServers.id,  unit: 'unit',          basePrice: 5999,  taxRate: 8, isSubscription: false, description: 'NVIDIA A30 24GB HBM2, PCIe, AI training & inference' },
    { sku: 'SS-BLADE-17',    name: 'Blade Server Half-Width Xeon',       categoryId: catServers.id,  unit: 'unit',          basePrice: 3999,  taxRate: 8, isSubscription: false, description: 'Intel Xeon E5 series, 2x10GbE, hot-swap drives, blade chassis compatible' },
    { sku: 'SS-RACK4U-18',   name: 'Rack Server 4U GPU Chassis 8x GPU', categoryId: catServers.id,  unit: 'unit',          basePrice: 7499,  taxRate: 8, isSubscription: false, description: '4U, supports 8x GPU, dual Xeon, redundant PSU, 2000W' },
    { sku: 'SS-BACKUP-19',   name: 'Backup Appliance 20TB Dedup',       categoryId: catServers.id,  unit: 'unit',          basePrice: 4999,  taxRate: 8, isSubscription: false, description: 'Integrated dedup & compression, virtual tape library, cloud-tiering' },
    { sku: 'SS-MGMT-20',     name: 'Server Management Card iDRAC/iLO',  categoryId: catServers.id,  unit: 'unit',          basePrice: 299,   taxRate: 8, isSubscription: false, description: 'Out-of-band management, remote KVM, lifecycle controller' },
    // Networking Equipment (20)
    { sku: 'NE-SW24G-01',    name: '24-Port Gigabit Managed Switch',    categoryId: catNetwork.id,  unit: 'unit',          basePrice: 349,   taxRate: 8, isSubscription: false, description: '24x GbE RJ45, 4x SFP+, L2+, VLAN, QoS, 370W PoE budget' },
    { sku: 'NE-SW48G-02',    name: '48-Port Gigabit L3 Managed Switch', categoryId: catNetwork.id,  unit: 'unit',          basePrice: 699,   taxRate: 8, isSubscription: false, description: '48x GbE, 4x 10GbE SFP+, Layer 3, OSPF, BGP, 740W PoE+' },
    { sku: 'NE-SW24POE-03',  name: '24-Port PoE+ Switch 370W',          categoryId: catNetwork.id,  unit: 'unit',          basePrice: 499,   taxRate: 8, isSubscription: false, description: '24x PoE+ (802.3at), 4x SFP, 370W total PoE, 1U rack' },
    { sku: 'NE-SW10G-04',    name: 'Core Switch 10G 24-Port SFP+',      categoryId: catNetwork.id,  unit: 'unit',          basePrice: 1999,  taxRate: 8, isSubscription: false, description: '24x 10GbE SFP+, 2x 100GbE QSFP28, L3, stacking, redundant PSU' },
    { sku: 'NE-AP-WIFI6-05', name: 'Wi-Fi 6 Access Point Indoor',       categoryId: catNetwork.id,  unit: 'unit',          basePrice: 349,   taxRate: 8, isSubscription: false, description: '802.11ax, 2.4+5GHz, 3.55 Gbps, 4x4 MU-MIMO, PoE+, WPA3' },
    { sku: 'NE-AP-WIFI6E-06',name: 'Wi-Fi 6E Access Point Tri-Band',    categoryId: catNetwork.id,  unit: 'unit',          basePrice: 599,   taxRate: 8, isSubscription: false, description: '802.11axe, 2.4+5+6GHz, 7.3 Gbps, 8x8 MU-MIMO, PoE++' },
    { sku: 'NE-AP-OUT-07',   name: 'Outdoor Access Point Wi-Fi 6 IP67', categoryId: catNetwork.id,  unit: 'unit',          basePrice: 799,   taxRate: 8, isSubscription: false, description: 'IP67, -40 to +70C, 2x GbE PoE in/out, lightning protection' },
    { sku: 'NE-FW-SMB-08',   name: 'SMB Firewall Appliance 1Gbps',      categoryId: catNetwork.id,  unit: 'unit',          basePrice: 999,   taxRate: 8, isSubscription: false, description: '1 Gbps throughput, IPS, SSL inspection, 8x GbE, HA ready' },
    { sku: 'NE-FW-ENT-09',   name: 'Enterprise NGFW Appliance 10Gbps',  categoryId: catNetwork.id,  unit: 'unit',          basePrice: 3999,  taxRate: 8, isSubscription: false, description: '10Gbps firewall, NGFW, SD-WAN, 4x10G SFP+, redundant PSU' },
    { sku: 'NE-RTR-ENT-10',  name: 'Enterprise Router Dual WAN SD-WAN', categoryId: catNetwork.id,  unit: 'unit',          basePrice: 899,   taxRate: 8, isSubscription: false, description: 'Dual WAN, 4x GbE LAN, VPN, BGP, OSPF, SD-WAN ready' },
    { sku: 'NE-VPN-11',      name: 'VPN Concentrator Appliance 500T',   categoryId: catNetwork.id,  unit: 'unit',          basePrice: 799,   taxRate: 8, isSubscription: false, description: '500 concurrent VPN tunnels, IPSec/SSL, HA pair support' },
    { sku: 'NE-CTRL-12',     name: 'Wireless LAN Controller 200 AP',    categoryId: catNetwork.id,  unit: 'unit',          basePrice: 2499,  taxRate: 8, isSubscription: false, description: 'Manages up to 200 APs, centralized WLAN, L2/L3 roaming' },
    { sku: 'NE-PATCH24-13',  name: 'Patch Panel 24-Port Cat6A 1U',      categoryId: catNetwork.id,  unit: 'unit',          basePrice: 99,    taxRate: 8, isSubscription: false, description: '24-port 1U, 10GbE Cat6A, 90 shielded keystone, T568A/B' },
    { sku: 'NE-CAT6-14',     name: 'Cat6 UTP Cable 305m Box',           categoryId: catNetwork.id,  unit: 'unit',          basePrice: 109,   taxRate: 8, isSubscription: false, description: '305m / 1000ft box, 23 AWG solid copper, CMR/CM rated, grey' },
    { sku: 'NE-SFP10G-15',   name: 'SFP+ 10G SR Transceiver 300m OM3', categoryId: catNetwork.id,  unit: 'unit',          basePrice: 79,    taxRate: 8, isSubscription: false, description: '10GbE, 850nm, OM3 300m / OM4 400m, LC duplex, MSA compliant' },
    { sku: 'NE-POE-INJ-16',  name: 'PoE+ Injector 30W Single Port',     categoryId: catNetwork.id,  unit: 'unit',          basePrice: 49,    taxRate: 8, isSubscription: false, description: '802.3at PoE+, 30W, pass-through, for APs and IP phones' },
    { sku: 'NE-IDS-17',      name: 'Network IDS/IPS Appliance 2Gbps',   categoryId: catNetwork.id,  unit: 'unit',          basePrice: 2999,  taxRate: 8, isSubscription: false, description: 'Inline IDS/IPS, 2Gbps throughput, 6x GbE, Snort-based engine' },
    { sku: 'NE-MEDIA-18',    name: 'Media Converter Fiber to Copper',   categoryId: catNetwork.id,  unit: 'unit',          basePrice: 59,    taxRate: 8, isSubscription: false, description: '100BASE-FX to 100BASE-TX, SC connector, auto-negotiation' },
    { sku: 'NE-CABLE-19',    name: 'Fiber Patch Cable LC-LC OM4 5m',    categoryId: catNetwork.id,  unit: 'unit',          basePrice: 19,    taxRate: 8, isSubscription: false, description: 'LC-LC Duplex, OM4 50/125um, 5m, 10/40/100GbE rated' },
    { sku: 'NE-SW8U-20',     name: '8-Port Gigabit Desktop Switch',     categoryId: catNetwork.id,  unit: 'unit',          basePrice: 39,    taxRate: 8, isSubscription: false, description: '8x 1GbE, auto-MDI/X, plug-and-play, compact desktop form' },
    // Monitors & Displays (15)
    { sku: 'MD-24FHD-01',    name: 'Monitor 24" FHD IPS 75Hz',          categoryId: catMonitors.id, unit: 'unit',          basePrice: 249,   taxRate: 8, isSubscription: false, description: '24" 1920x1080 IPS, 75Hz, HDMI+DP+VGA, USB hub, VESA 100mm' },
    { sku: 'MD-27QHD-02',    name: 'Monitor 27" QHD IPS Height Adj.',   categoryId: catMonitors.id, unit: 'unit',          basePrice: 399,   taxRate: 8, isSubscription: false, description: '27" 2560x1440 IPS, 75Hz, sRGB 99%, HDMI+DP, height adjustable' },
    { sku: 'MD-274K-03',     name: 'Monitor 27" 4K UHD USB-C 65W',      categoryId: catMonitors.id, unit: 'unit',          basePrice: 549,   taxRate: 8, isSubscription: false, description: '27" 3840x2160 IPS, 60Hz, USB-C 65W PD, 4K, HDR400' },
    { sku: 'MD-324K-04',     name: 'Monitor 32" 4K HDR 144Hz KVM',      categoryId: catMonitors.id, unit: 'unit',          basePrice: 749,   taxRate: 8, isSubscription: false, description: '32" 4K VA, HDR600, 144Hz, 1ms, USB-C 90W, KVM switch' },
    { sku: 'MD-34UW-05',     name: 'Ultrawide 34" Curved QHD+ 100Hz',   categoryId: catMonitors.id, unit: 'unit',          basePrice: 899,   taxRate: 8, isSubscription: false, description: '34" 3440x1440 IPS, 100Hz, USB-C 90W, 2xHDMI, DP, KVM' },
    { sku: 'MD-STAND-06',    name: 'Dual Monitor Arm Stand Desk Mount', categoryId: catMonitors.id, unit: 'unit',          basePrice: 129,   taxRate: 8, isSubscription: false, description: 'Full-motion, two-arm, VESA 75/100mm, fits 17-32" monitors' },
    { sku: 'MD-24TCH-07',    name: 'Touch Monitor 24" FHD USB-C',       categoryId: catMonitors.id, unit: 'unit',          basePrice: 499,   taxRate: 8, isSubscription: false, description: '24" FHD 10-point touch, IPS, USB-C, ideal for POS/kiosk' },
    { sku: 'MD-55VW-08',     name: 'Video Wall Display 55" 4K Bezel',   categoryId: catMonitors.id, unit: 'unit',          basePrice: 1499,  taxRate: 8, isSubscription: false, description: '55" 4K LCD, 3.5mm ultra-narrow bezel, 24/7 rated, 3yr on-site' },
    { sku: 'MD-43DS-09',     name: 'Digital Signage Display 43" Android',categoryId: catMonitors.id, unit: 'unit',          basePrice: 799,   taxRate: 8, isSubscription: false, description: '43" FHD, IPS, Android 11, Wi-Fi, portrait/landscape, 24/7 rated' },
    { sku: 'MD-75CF-10',     name: 'Conference Room Display 75" 4K Android',categoryId: catMonitors.id, unit: 'unit',      basePrice: 2499,  taxRate: 8, isSubscription: false, description: '75" 4K UHD, HDMI 2.0, USB-C, built-in Android, Wi-Fi, AMS' },
    { sku: 'MD-PROJ-11',     name: 'Projector 4K Laser 5000 Lumens',    categoryId: catMonitors.id, unit: 'unit',          basePrice: 1899,  taxRate: 8, isSubscription: false, description: '4K UHD, 5000 ANSI lumens, 20,000hr laser, HDMI 2.0, HDR' },
    { sku: 'MD-27OLED-12',   name: 'Monitor 27" OLED 4K Creator',       categoryId: catMonitors.id, unit: 'unit',          basePrice: 999,   taxRate: 8, isSubscription: false, description: '27" OLED 4K, 0.1ms, DCI-P3 99%, USB-C 90W, for creative pros' },
    { sku: 'MD-ARM-13',      name: 'Monitor Arm Single Gas Spring',     categoryId: catMonitors.id, unit: 'unit',          basePrice: 89,    taxRate: 8, isSubscription: false, description: 'Gas spring arm, VESA 75/100mm, clamp+grommet, 17-32"' },
    { sku: 'MD-24EYECARE-14',name: 'Monitor 24" FHD Eye Care TUV',      categoryId: catMonitors.id, unit: 'unit',          basePrice: 279,   taxRate: 8, isSubscription: false, description: '24" FHD IPS, Flicker-free, Low Blue Light, TUV certified' },
    { sku: 'MD-PRIV-15',     name: 'Privacy Screen Filter 27" 16:9',    categoryId: catMonitors.id, unit: 'unit',          basePrice: 69,    taxRate: 8, isSubscription: false, description: '27" 16:9 anti-glare privacy filter, 60-deg viewing angle' },
    // Peripherals & Accessories (25)
    { sku: 'PA-KBMS-01',     name: 'Wireless Keyboard & Mouse Combo',   categoryId: catPeripherals.id, unit: 'unit',        basePrice: 89,    taxRate: 8, isSubscription: false, description: '2.4GHz wireless, quiet keys, ergonomic mouse, 24-month battery' },
    { sku: 'PA-KB-MECH-02',  name: 'Mechanical Keyboard Tenkeyless',    categoryId: catPeripherals.id, unit: 'unit',        basePrice: 149,   taxRate: 8, isSubscription: false, description: 'TKL, Cherry MX Brown, white backlit, USB-C detachable cable' },
    { sku: 'PA-MOUSE-ERG-03',name: 'Ergonomic Vertical Mouse Wireless', categoryId: catPeripherals.id, unit: 'unit',        basePrice: 79,    taxRate: 8, isSubscription: false, description: 'Vertical grip, 800-2400 DPI, wireless 2.4GHz, 18-month battery' },
    { sku: 'PA-HUB-7IN1-04', name: 'USB-C Hub 7-in-1 4K HDMI',         categoryId: catPeripherals.id, unit: 'unit',        basePrice: 59,    taxRate: 8, isSubscription: false, description: '4K HDMI, 3x USB-A 3.0, SD, MicroSD, 100W PD, plug & play' },
    { sku: 'PA-DOCK-12-05',  name: 'USB-C Dock Pro 12-Port Dual 4K',   categoryId: catPeripherals.id, unit: 'unit',        basePrice: 229,   taxRate: 8, isSubscription: false, description: '2x4K HDMI, DP, 4x USB-A, 2x USB-C, Ethernet, SD, 100W PD' },
    { sku: 'PA-CAM-4K-06',   name: 'Webcam 4K USB-C AI Auto-Frame',     categoryId: catPeripherals.id, unit: 'unit',        basePrice: 179,   taxRate: 8, isSubscription: false, description: '4K 30fps, HDR, AI auto-framing, built-in stereo mic, privacy shutter' },
    { sku: 'PA-HSET-USB-07', name: 'USB Stereo Headset NC Mic',         categoryId: catPeripherals.id, unit: 'unit',        basePrice: 79,    taxRate: 8, isSubscription: false, description: 'USB, wideband audio, noise-cancelling mic, foldable, call center certified' },
    { sku: 'PA-HSET-BT-08',  name: 'Bluetooth ANC Headset Teams Cert', categoryId: catPeripherals.id, unit: 'unit',        basePrice: 249,   taxRate: 8, isSubscription: false, description: 'ANC, Bluetooth 5.1, 40hr battery, multipoint, MS Teams certified' },
    { sku: 'PA-BARCODE-09',  name: 'Barcode Scanner 2D USB Omni',       categoryId: catPeripherals.id, unit: 'unit',        basePrice: 199,   taxRate: 8, isSubscription: false, description: '2D omnidirectional, USB HID, reads 1D/2D/QR, IP42 rated' },
    { sku: 'PA-LBLPRT-10',   name: 'Label Printer 4" Thermal Direct',   categoryId: catPeripherals.id, unit: 'unit',        basePrice: 299,   taxRate: 8, isSubscription: false, description: '4" direct thermal, 203 DPI, USB+Ethernet+Wi-Fi, ZPL compatible' },
    { sku: 'PA-CAM-HD-11',   name: 'Webcam HD 1080p Ring Light USB',    categoryId: catPeripherals.id, unit: 'unit',        basePrice: 89,    taxRate: 8, isSubscription: false, description: '1080p 30fps, built-in ring light, auto-focus, USB-A, clip mount' },
    { sku: 'PA-PRINT-LASER-12',name: 'Laser Printer Mono 40ppm Duplex',categoryId: catPeripherals.id, unit: 'unit',        basePrice: 299,   taxRate: 8, isSubscription: false, description: 'A4 mono laser, 40ppm, 1200dpi, duplex, USB+Ethernet+Wi-Fi' },
    { sku: 'PA-PRINT-CLR-13',name: 'Color Laser Printer 30ppm NFC',     categoryId: catPeripherals.id, unit: 'unit',        basePrice: 499,   taxRate: 8, isSubscription: false, description: 'A4 color laser, 30ppm color, NFC, Wi-Fi, mobile print, duplex' },
    { sku: 'PA-MFP-14',      name: 'Multifunction Laser Printer A3',    categoryId: catPeripherals.id, unit: 'unit',        basePrice: 899,   taxRate: 8, isSubscription: false, description: 'A3 color laser MFP, print/copy/scan/fax, 50ppm, 4GB, secure print' },
    { sku: 'PA-SCAN-A4-15',  name: 'Flatbed Scanner A4 ADF 600dpi',     categoryId: catPeripherals.id, unit: 'unit',        basePrice: 199,   taxRate: 8, isSubscription: false, description: 'A4 flatbed + ADF 50-sheet, 600dpi, USB, OCR software included' },
    { sku: 'PA-SHRED-16',    name: 'Cross-Cut Paper Shredder P-4',      categoryId: catPeripherals.id, unit: 'unit',        basePrice: 179,   taxRate: 8, isSubscription: false, description: 'DIN P-4 cross-cut, 12 sheets, CD/card shred, 22L bin, auto-reverse' },
    { sku: 'PA-PHONE-IP-17', name: 'IP Desk Phone PoE Color Screen SIP',categoryId: catPeripherals.id, unit: 'unit',        basePrice: 149,   taxRate: 8, isSubscription: false, description: '3.5" color LCD, 16 SIP accounts, PoE, Bluetooth, Wi-Fi, USB' },
    { sku: 'PA-SPK-BT-18',   name: 'Portable Bluetooth Speaker IP67',   categoryId: catPeripherals.id, unit: 'unit',        basePrice: 99,    taxRate: 8, isSubscription: false, description: 'IP67, 360 sound, 20hr battery, USB-C, NFC pairing, outdoor rated' },
    { sku: 'PA-SURGE-19',    name: 'Surge Protector 8-Outlet 2m 4320J',categoryId: catPeripherals.id, unit: 'unit',        basePrice: 49,    taxRate: 8, isSubscription: false, description: '8 outlets, 2m cord, 4320J protection, 2x USB-A charging, indicator' },
    { sku: 'PA-HDMI-4K-20',  name: 'HDMI 2.1 Cable 2m 48Gbps 8K',      categoryId: catPeripherals.id, unit: 'unit',        basePrice: 19,    taxRate: 8, isSubscription: false, description: '2m HDMI 2.1, 8K@60Hz, 4K@120Hz, 48Gbps, Ultra HD certified' },
    { sku: 'PA-KBMS-BT-21',  name: 'Bluetooth Keyboard & Mouse Multi-Device',categoryId: catPeripherals.id, unit: 'unit',  basePrice: 99,    taxRate: 8, isSubscription: false, description: 'Bluetooth 5.0, multi-device 3-way, rechargeable, slim profile' },
    { sku: 'PA-TRACK-22',    name: 'Ergonomic Trackball Mouse Wireless',categoryId: catPeripherals.id, unit: 'unit',        basePrice: 89,    taxRate: 8, isSubscription: false, description: 'Thumb-operated trackball, wireless, DPI 400-2000, 18-month battery' },
    { sku: 'PA-MOUSEPAD-23', name: 'Large Desk Pad 90x45cm Stitched',   categoryId: catPeripherals.id, unit: 'unit',        basePrice: 29,    taxRate: 8, isSubscription: false, description: 'XXL extended mouse pad, stitched edges, non-slip rubber base' },
    { sku: 'PA-KBCVR-24',    name: 'Keyboard Cover Silicone Washable',  categoryId: catPeripherals.id, unit: 'unit',        basePrice: 15,    taxRate: 8, isSubscription: false, description: 'Washable silicone keyboard protector, ultra-thin, custom fit options' },
    { sku: 'PA-EXTCAM-25',   name: 'Smart 360 Meeting Room Camera 4K',  categoryId: catPeripherals.id, unit: 'unit',        basePrice: 399,   taxRate: 8, isSubscription: false, description: '360-deg 4K, AI speaker tracking, USB, Plug & Play, huddle rooms' },
    // Professional Services (20)
    { sku: 'PS-SETUP-01',    name: 'Device Setup & Configuration',      categoryId: catServices.id, unit: 'per device',   basePrice: 150,   taxRate: 0, isSubscription: false, description: 'OS install, software deployment, domain join, user profile setup' },
    { sku: 'PS-NETINST-02',  name: 'Network Installation Service',      categoryId: catServices.id, unit: 'engagement',   basePrice: 1499,  taxRate: 0, isSubscription: false, description: 'Structured cabling, switch config, AP deployment, up to 50-node' },
    { sku: 'PS-SVRACK-03',   name: 'Server Rack Installation Service',  categoryId: catServices.id, unit: 'engagement',   basePrice: 999,   taxRate: 0, isSubscription: false, description: 'Rack-mount servers, cable management, IPMI setup, basic OS install' },
    { sku: 'PS-CLOUD-04',    name: 'Cloud Migration Service',           categoryId: catServices.id, unit: 'engagement',   basePrice: 3500,  taxRate: 0, isSubscription: false, description: 'Lift-and-shift to Azure/AWS/GCP, up to 20 VMs, data migration incl.' },
    { sku: 'PS-AUDIT-05',    name: 'IT Security Audit & Pen Test',      categoryId: catServices.id, unit: 'engagement',   basePrice: 2499,  taxRate: 0, isSubscription: false, description: 'Vulnerability scan, pen test, compliance gap report, remediation plan' },
    { sku: 'PS-BACKUP-06',   name: 'Backup Solution Setup Service',     categoryId: catServices.id, unit: 'engagement',   basePrice: 799,   taxRate: 0, isSubscription: false, description: '3-2-1 backup strategy implementation, Veeam/Acronis config, DR test' },
    { sku: 'PS-HD-07',       name: 'Helpdesk Support Day Rate',         categoryId: catServices.id, unit: 'day',          basePrice: 599,   taxRate: 0, isSubscription: false, description: 'On-site or remote helpdesk, up to 8hr day, L1/L2 support' },
    { sku: 'PS-ONSITE-08',   name: 'On-site Field Engineer Full Day',   categoryId: catServices.id, unit: 'day',          basePrice: 799,   taxRate: 0, isSubscription: false, description: 'Certified field engineer, 8hr, travel <50km, hardware & software' },
    { sku: 'PS-PM-09',       name: 'IT Project Management Day Rate',    categoryId: catServices.id, unit: 'day',          basePrice: 999,   taxRate: 0, isSubscription: false, description: 'PMP-certified PM, project planning, stakeholder mgmt, reporting' },
    { sku: 'PS-TRAIN-10',    name: 'End-User Training Session Half-Day',categoryId: catServices.id, unit: 'session',      basePrice: 699,   taxRate: 0, isSubscription: false, description: 'Half-day group training, up to 15 users, custom agenda, handouts' },
    { sku: 'PS-LICENSE-11',  name: 'Software License Deployment',       categoryId: catServices.id, unit: 'engagement',   basePrice: 499,   taxRate: 0, isSubscription: false, description: 'License activation, volume deployment, compliance audit, asset register' },
    { sku: 'PS-WIFI-12',     name: 'Wireless RF Site Survey Service',   categoryId: catServices.id, unit: 'engagement',   basePrice: 999,   taxRate: 0, isSubscription: false, description: 'RF site survey, heat map, channel plan, AP placement recommendations' },
    { sku: 'PS-DR-13',       name: 'Disaster Recovery Planning Service',categoryId: catServices.id, unit: 'engagement',   basePrice: 1999,  taxRate: 0, isSubscription: false, description: 'BIA, RTO/RPO definition, DR runbook, annual tabletop exercise' },
    { sku: 'PS-COMP-14',     name: 'Compliance Consulting Day Rate',    categoryId: catServices.id, unit: 'day',          basePrice: 1199,  taxRate: 0, isSubscription: false, description: 'ISO 27001, SOC 2, GDPR, HIPAA gap analysis and advisory services' },
    { sku: 'PS-REFRESH-15',  name: 'Hardware Refresh Consulting',       categoryId: catServices.id, unit: 'engagement',   basePrice: 899,   taxRate: 0, isSubscription: false, description: 'Lifecycle assessment, refresh roadmap, e-waste coordination, data wipe cert' },
    { sku: 'PS-NOC-16',      name: 'NOC Monitoring Setup Service',      categoryId: catServices.id, unit: 'engagement',   basePrice: 1499,  taxRate: 0, isSubscription: false, description: 'SNMP/Syslog config, alerting rules, dashboard, integration to ticketing' },
    { sku: 'PS-VIRT-17',     name: 'Server Virtualization Deployment',  categoryId: catServices.id, unit: 'engagement',   basePrice: 1999,  taxRate: 0, isSubscription: false, description: 'VMware ESXi or Proxmox, VMs migrated, HA cluster config, 5-server max' },
    { sku: 'PS-MSFT-18',     name: 'Microsoft 365 Tenant Setup',        categoryId: catServices.id, unit: 'engagement',   basePrice: 999,   taxRate: 0, isSubscription: false, description: 'Tenant creation, Exchange/Teams/SharePoint config, MFA, Intune enrol' },
    { sku: 'PS-PENTEST-19',  name: 'Penetration Testing Web App OWASP', categoryId: catServices.id, unit: 'engagement',   basePrice: 3999,  taxRate: 0, isSubscription: false, description: 'OWASP Top 10, authenticated + unauthenticated, full report, retest incl.' },
    { sku: 'PS-PHISH-20',    name: 'Phishing Simulation & Awareness',   categoryId: catServices.id, unit: 'engagement',   basePrice: 1299,  taxRate: 0, isSubscription: false, description: 'Simulated phishing campaign, detailed click report, awareness training' },
    // Cloud Software Subscriptions (30)
    { sku: 'CS-M365-BAS-01', name: 'Microsoft 365 Business Basic',      categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 6,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Web apps, 1TB OneDrive, Teams, Exchange 50GB, no Office desktop' },
    { sku: 'CS-M365-STD-02', name: 'Microsoft 365 Business Standard',   categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 12.5,  taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Office desktop apps, Teams, SharePoint, Bookings, Intune basic' },
    { sku: 'CS-M365-E3-03',  name: 'Microsoft 365 E3',                  categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 36,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Full M365, Defender, Purview, Intune, Advanced eDiscovery' },
    { sku: 'CS-AZURE-VM-04', name: 'Azure VM Standard D4s v5',          categoryId: catCloud.id,    unit: 'instance/mo',  basePrice: 175,   taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: '4 vCPU, 16GB RAM, 100GB managed SSD, Azure IaaS VM' },
    { sku: 'CS-AZURE-STG-05',name: 'Azure Blob Storage per TB',         categoryId: catCloud.id,    unit: 'TB/month',     basePrice: 21,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Azure Blob LRS hot tier, per TB per month, egress extra' },
    { sku: 'CS-GWS-STR-06',  name: 'Google Workspace Business Starter', categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 6,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Gmail, Meet, Drive 30GB, Docs/Sheets/Slides, basic security' },
    { sku: 'CS-GWS-STD-07',  name: 'Google Workspace Business Standard',categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 12,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: '2TB Drive, Meet 500 participants, recording, Vault lite, AppSheet' },
    { sku: 'CS-GWS-PLUS-08', name: 'Google Workspace Business Plus',    categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 18,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: '5TB Drive, Vault, DLP, advanced Meet, endpoint management' },
    { sku: 'CS-SFDC-STR-09', name: 'Salesforce Sales Cloud Starter',    categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 25,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Basic CRM, accounts, contacts, opportunities, leads, email integration' },
    { sku: 'CS-SFDC-PRO-10', name: 'Salesforce Sales Cloud Professional',categoryId: catCloud.id,   unit: 'seat/month',   basePrice: 75,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Full CRM, workflow automation, forecasting, API, territories' },
    { sku: 'CS-SLACK-PRO-11',name: 'Slack Pro',                         categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 7.25,  taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Unlimited message history, apps, guest access, workflow builder' },
    { sku: 'CS-SLACK-BIZ-12',name: 'Slack Business+ SAML SSO',         categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 12.5,  taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'SAML SSO, 99.99% SLA, Slack Atlas, user provisioning, DLP' },
    { sku: 'CS-ZOOM-BIZ-13', name: 'Zoom Business 300-Participant',     categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 15.99, taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: '300-participant meetings, transcripts, scheduler, Zoom Whiteboard' },
    { sku: 'CS-ZOOM-PHN-14', name: 'Zoom Phone Pro Cloud PBX',         categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 10,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Cloud PBX, unlimited domestic calls, IVR, call recording, analytics' },
    { sku: 'CS-DBX-BIZ-15',  name: 'Dropbox Business Plus 15TB',       categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 16.58, taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: '15TB pooled storage, Paper, eSign, admin console, priority support' },
    { sku: 'CS-DOCUSIGN-16', name: 'DocuSign Business Pro Unlimited',   categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 40,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Unlimited envelopes, bulk send, signer ID, embedded signing, API' },
    { sku: 'CS-ADOBE-17',    name: 'Adobe Acrobat Pro PDF eSign',       categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 19.99, taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'PDF create/edit/sign, export to Office, OCR, e-sign, 100GB cloud' },
    { sku: 'CS-AV-EPT-18',   name: 'Endpoint Antivirus Next-Gen',       categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 4.5,   taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Next-gen AV, ransomware protection, web filtering, central console' },
    { sku: 'CS-EDR-19',      name: 'Endpoint Detection & Response AI',  categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 12,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'AI-driven EDR, threat hunting, SIEM integration, 24/7 SOC alerts' },
    { sku: 'CS-CBKP-20',     name: 'Cloud Backup per TB Encrypted',     categoryId: catCloud.id,    unit: 'TB/month',     basePrice: 15,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Offsite encrypted backup, versioning 30 days, instant restore, SLA 99.9%' },
    { sku: 'CS-MDM-21',      name: 'MDM Platform per Device UEM',       categoryId: catCloud.id,    unit: 'device/month', basePrice: 4,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'iOS/Android/Windows/macOS MDM, app push, remote wipe, policy mgmt' },
    { sku: 'CS-VPN-BIZ-22',  name: 'Business VPN per Seat AES-256',     categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 6,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'AES-256, zero-log, split tunneling, 50+ countries, 5 devices per seat' },
    { sku: 'CS-PWD-23',      name: 'Password Manager Business SOC2',    categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 5,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Unlimited passwords, dark web monitoring, SSO, admin console, SOC2' },
    { sku: 'CS-JIRA-24',     name: 'Jira Software Standard Cloud',      categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 8.15,  taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Scrum/Kanban boards, roadmaps, unlimited projects, 250GB storage' },
    { sku: 'CS-CNFL-25',     name: 'Confluence Standard Cloud Wiki',    categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 5.75,  taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Team wiki, page templates, spaces, search, MS/Jira integration' },
    { sku: 'CS-SIGN-26',     name: 'Digital Signing Platform Qualified',categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 18,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Unlimited signatures, audit trail, qualified eSign, multi-party workflow' },
    { sku: 'CS-M365-F1-27',  name: 'Microsoft 365 F1 Frontline Worker', categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 2.25,  taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Web Office, Teams, 2GB Exchange, shift scheduling for frontline workers' },
    { sku: 'CS-INTUNE-28',   name: 'Microsoft Intune per Device Cloud',  categoryId: catCloud.id,    unit: 'device/month', basePrice: 8,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Cloud-native UEM, policy mgmt, app delivery, compliance, co-management' },
    { sku: 'CS-AZURE-AAD-29',name: 'Microsoft Entra ID P2 Conditional', categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 9,     taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'MFA, Conditional Access, PIM, Identity Protection, Access Reviews' },
    { sku: 'CS-SIEM-30',     name: 'SIEM Cloud Platform Log Analytics',  categoryId: catCloud.id,    unit: 'seat/month',   basePrice: 35,    taxRate: 5, isSubscription: true, recurringInterval: 'MONTHLY', description: 'Log ingestion, threat correlation, SOAR, compliance reports, 12mo retention' },
    // Security Solutions (20)
    { sku: 'SEC-FIDO-01',    name: 'FIDO2 Hardware Security Key USB+NFC',categoryId: catSecurity.id, unit: 'unit',         basePrice: 49,    taxRate: 8, isSubscription: false, description: 'FIDO2/U2F/TOTP, USB-A+NFC, phishing-resistant MFA' },
    { sku: 'SEC-SCRD-02',    name: 'Smart Card Reader USB PIV/CAC',      categoryId: catSecurity.id, unit: 'unit',         basePrice: 49,    taxRate: 8, isSubscription: false, description: 'USB 2.0, ISO 7816, compatible with PIV/CAC, plug & play' },
    { sku: 'SEC-FINGER-03',  name: 'Fingerprint Scanner USB Windows Hello',categoryId: catSecurity.id, unit: 'unit',       basePrice: 99,    taxRate: 8, isSubscription: false, description: 'USB biometric, 500dpi, Windows Hello, Linux compatible' },
    { sku: 'SEC-CAM4MP-04',  name: 'IP Camera 4MP Dome PoE IP67',       categoryId: catSecurity.id, unit: 'unit',         basePrice: 199,   taxRate: 8, isSubscription: false, description: '4MP 2.8mm, H.265+, WDR, IR 30m, IP67, IK10, microSD' },
    { sku: 'SEC-CAM8PTZ-05', name: 'IP Camera 8MP PTZ 30x Optical',     categoryId: catSecurity.id, unit: 'unit',         basePrice: 799,   taxRate: 8, isSubscription: false, description: '8MP PTZ, 30x optical zoom, IR 100m, SIP, PoE+, IP66' },
    { sku: 'SEC-NVR16-06',   name: 'NVR 16-Channel 4K 16-Port PoE',     categoryId: catSecurity.id, unit: 'unit',         basePrice: 699,   taxRate: 8, isSubscription: false, description: '16-ch, 4K decode, 2x SATA bays, HDMI 4K out, 16-port PoE' },
    { sku: 'SEC-ACCESS-07',  name: 'IP Access Control Panel 4-Door',     categoryId: catSecurity.id, unit: 'unit',         basePrice: 699,   taxRate: 8, isSubscription: false, description: '4-door, TCP/IP, Wiegand, OSDP, 100,000 card capacity' },
    { sku: 'SEC-CARD-RD-08', name: 'RFID Door Card Reader 125kHz',       categoryId: catSecurity.id, unit: 'unit',         basePrice: 149,   taxRate: 8, isSubscription: false, description: '125kHz EM/HID, Wiegand 26-bit, IP65, -40 to 70C, LED+buzzer' },
    { sku: 'SEC-BADGE-09',   name: 'ID Badge Printer Dual-Side 300dpi',  categoryId: catSecurity.id, unit: 'unit',         basePrice: 1199,  taxRate: 8, isSubscription: false, description: 'Dual-side, retransfer printing, 300 dpi, USB+Ethernet, 200 cards/hr' },
    { sku: 'SEC-SAFE-10',    name: 'Electronic Safe Box 30L Fingerprint',categoryId: catSecurity.id, unit: 'unit',         basePrice: 299,   taxRate: 8, isSubscription: false, description: '30L, fingerprint+PIN+key, 3mm steel, anchor bolts included' },
    { sku: 'SEC-FW-HW-11',   name: 'Next-Gen Firewall Appliance 5Gbps', categoryId: catSecurity.id, unit: 'unit',         basePrice: 2499,  taxRate: 8, isSubscription: false, description: '5Gbps NGFW, IPS, App-ID, URL filtering, 8x GbE, redundant PSU' },
    { sku: 'SEC-WAF-12',     name: 'Web Application Firewall Inline',    categoryId: catSecurity.id, unit: 'unit',         basePrice: 1999,  taxRate: 8, isSubscription: false, description: 'OWASP protection, L7 DPI, SSL inspection, 2Gbps, 4x SFP+' },
    { sku: 'SEC-PAM-13',     name: 'Privileged Access Management PAM',   categoryId: catSecurity.id, unit: 'unit',         basePrice: 3999,  taxRate: 8, isSubscription: false, description: 'PAM vault, session recording, password rotation, LDAP/AD, MFA' },
    { sku: 'SEC-HSM-14',     name: 'Hardware Security Module FIPS 140-2',categoryId: catSecurity.id, unit: 'unit',         basePrice: 8999,  taxRate: 8, isSubscription: false, description: 'FIPS 140-2 Level 3, PCIe + USB, RSA 4096, ECC, AES-256' },
    { sku: 'SEC-LOCK-15',    name: 'Physical Security Cable Lock 1.8m',  categoryId: catSecurity.id, unit: 'unit',         basePrice: 29,    taxRate: 8, isSubscription: false, description: 'Kensington-compatible, 4-digit combination, 1.8m, zinc alloy' },
    { sku: 'SEC-CAM-DOME-16',name: 'IP Camera 2MP Indoor Dome ONVIF',    categoryId: catSecurity.id, unit: 'unit',         basePrice: 99,    taxRate: 8, isSubscription: false, description: '2MP, H.264, fixed 2.8mm, IR 20m, PoE, microSD 128GB, ONVIF' },
    { sku: 'SEC-SIEM-HW-17', name: 'SIEM Log Collector Appliance 10KEPS',categoryId: catSecurity.id, unit: 'unit',         basePrice: 4999,  taxRate: 8, isSubscription: false, description: '10,000 EPS, 4TB storage, pre-installed SIEM, 2x 10GbE, redundant PSU' },
    { sku: 'SEC-DLP-18',     name: 'DLP Network Appliance Email+Web',    categoryId: catSecurity.id, unit: 'unit',         basePrice: 3499,  taxRate: 8, isSubscription: false, description: 'Data loss prevention inline, email + web + endpoint, ICAP protocol' },
    { sku: 'SEC-PANIC-19',   name: 'Panic Button Wireless 5-Pack',       categoryId: catSecurity.id, unit: 'pack',         basePrice: 299,   taxRate: 8, isSubscription: false, description: '5x wireless panic buttons, 200m range, receiver included, silent alert' },
    { sku: 'SEC-TURNSTILE-20',name: 'Optical Turnstile Speed Gate',      categoryId: catSecurity.id, unit: 'unit',         basePrice: 4999,  taxRate: 8, isSubscription: false, description: 'Bi-directional, 40 passes/min, Wiegand, OSDP, tempered glass wings' },
    // Audio/Video & Conferencing (15)
    { sku: 'AV-CAM4K-01',   name: 'Conference Room Camera 4K PTZ 12x',  categoryId: catAV.id,       unit: 'unit',         basePrice: 999,   taxRate: 8, isSubscription: false, description: '4K 30fps, 12x optical, USB+HDMI+IP, 120-deg wide-angle, PoE' },
    { sku: 'AV-SPK-01',     name: 'USB Speakerphone 360-Degree 8-Mic',  categoryId: catAV.id,       unit: 'unit',         basePrice: 299,   taxRate: 8, isSubscription: false, description: '8-mic array, 360-deg pickup 6m, AEC, USB+Bluetooth, MS Teams certified' },
    { sku: 'AV-BAR-01',     name: 'Video Bar All-in-One 4K USB',         categoryId: catAV.id,       unit: 'unit',         basePrice: 1499,  taxRate: 8, isSubscription: false, description: '4K camera + speaker + mic in one bar, USB, HDMI, Bluetooth, NFC pairing' },
    { sku: 'AV-HDMI-MTX-02',name: 'HDMI Matrix 4x4 4K 60Hz Switcher',   categoryId: catAV.id,       unit: 'unit',         basePrice: 699,   taxRate: 8, isSubscription: false, description: '4-in 4-out HDMI 2.0, 4K60Hz, web GUI, RS-232, TCP/IP control' },
    { sku: 'AV-WPS-01',     name: 'Wireless Presentation System 4K',     categoryId: catAV.id,       unit: 'unit',         basePrice: 799,   taxRate: 8, isSubscription: false, description: '4K wireless HDMI, 4 concurrent users, airplay/Miracast, BYOD' },
    { sku: 'AV-USBC-CAM-03',name: 'USB-C Huddle Room Camera 1080p 110d',categoryId: catAV.id,       unit: 'unit',         basePrice: 349,   taxRate: 8, isSubscription: false, description: '1080p 30fps, 110-deg wide, USB-C + USB-A, plug & play, Teams/Zoom' },
    { sku: 'AV-DWB-65-04',  name: 'Digital Whiteboard 65" 4K Touch Android',categoryId: catAV.id,   unit: 'unit',         basePrice: 3499,  taxRate: 8, isSubscription: false, description: '65" 4K 20-point touch, Android 11, OPS slot, USB-C, Teams/Zoom certif.' },
    { sku: 'AV-MIC-CEIL-05',name: 'Ceiling Microphone Array 8-Element', categoryId: catAV.id,       unit: 'unit',         basePrice: 699,   taxRate: 8, isSubscription: false, description: '8-element ceiling mic, 6m pickup radius, PoE, AEC, echo cancel, USB' },
    { sku: 'AV-AMP-06',     name: 'Audio Amplifier 4-Channel 70W Class-D',categoryId: catAV.id,     unit: 'unit',         basePrice: 499,   taxRate: 8, isSubscription: false, description: '4-channel 70W class-D amp, XLR+RCA in, speaker terminals, 1U rack' },
    { sku: 'AV-SNDBAR-07',  name: 'Conference Soundbar 2.1 200W',        categoryId: catAV.id,       unit: 'unit',         basePrice: 399,   taxRate: 8, isSubscription: false, description: '2.1 soundbar with sub, optical+HDMI ARC+Bluetooth, 200W total' },
    { sku: 'AV-RACK-09',    name: 'AV Rack Cabinet 12U Open Frame',      categoryId: catAV.id,       unit: 'unit',         basePrice: 399,   taxRate: 8, isSubscription: false, description: '12U open-frame AV rack, steel, casters + leveling feet, 19" EIA' },
    { sku: 'AV-HDMIEXT-10', name: 'HDMI Extender Kit 70m Cat6 4K',       categoryId: catAV.id,       unit: 'unit',         basePrice: 149,   taxRate: 8, isSubscription: false, description: '4K@30Hz HDMI over Cat6, 70m range, EDID management, PoC' },
    { sku: 'AV-DONGLE-11',  name: 'Screen Share Dongle USB-C Wireless',  categoryId: catAV.id,       unit: 'unit',         basePrice: 99,    taxRate: 8, isSubscription: false, description: '1080p wireless display dongle, USB-C, plug & play, <1s latency' },
    { sku: 'AV-PROJ-SCR-12',name: 'Motorized Projector Screen 120" 16:9',categoryId: catAV.id,      unit: 'unit',         basePrice: 499,   taxRate: 8, isSubscription: false, description: '120" diagonal, 16:9, 1.1 gain, remote + RS-232 + IR control, ceiling mount' },
    { sku: 'AV-PODIUM-13',  name: 'Presentation Podium with Condenser Mic',categoryId: catAV.id,    unit: 'unit',         basePrice: 1299,  taxRate: 8, isSubscription: false, description: 'Lectern with integrated condenser mic, USB hub, reading light, power strip' },
    // Power & Infrastructure (20)
    { sku: 'PI-UPS650-01',  name: 'UPS 650VA Tower Desktop AVR USB',     categoryId: catPower.id,    unit: 'unit',         basePrice: 99,    taxRate: 8, isSubscription: false, description: '650VA/400W, 6 outlets, LCD, AVR, USB, 2-yr battery, for desktops' },
    { sku: 'PI-UPS1500-02', name: 'UPS 1500VA LCD Tower Hot-Swap',       categoryId: catPower.id,    unit: 'unit',         basePrice: 229,   taxRate: 8, isSubscription: false, description: '1500VA/900W, 8 outlets, AVR, LCD, USB+RS-232, hot-swap battery' },
    { sku: 'PI-UPS3000-03', name: 'UPS 3000VA 2U Rack/Tower Convertible',categoryId: catPower.id,   unit: 'unit',         basePrice: 799,   taxRate: 8, isSubscription: false, description: '3000VA/2700W, 2U convertible, SNMP card slot, hot-swap, 8 outlets' },
    { sku: 'PI-UPS10K-04',  name: 'UPS 10kVA Online Double-Conversion',  categoryId: catPower.id,    unit: 'unit',         basePrice: 3499,  taxRate: 8, isSubscription: false, description: '10kVA/9kW, true online double-conversion, 6U, SNMP, parallel capability' },
    { sku: 'PI-CAB42U-05',  name: 'Server Cabinet 42U 800x1000mm Rack',  categoryId: catPower.id,    unit: 'unit',         basePrice: 1199,  taxRate: 8, isSubscription: false, description: '42U, 800x1000mm, perforated doors front/rear, 2000kg load, casters' },
    { sku: 'PI-CAB24U-06',  name: 'Server Cabinet 24U 600x800mm Glass',  categoryId: catPower.id,    unit: 'unit',         basePrice: 699,   taxRate: 8, isSubscription: false, description: '24U, 600x800mm, lockable glass front door, cable management' },
    { sku: 'PI-CAB12U-07',  name: 'Wall-Mount Cabinet 12U Swing Open',   categoryId: catPower.id,    unit: 'unit',         basePrice: 299,   taxRate: 8, isSubscription: false, description: '12U wall mount, swings open 180-deg, vented, lockable, 60kg capacity' },
    { sku: 'PI-PDU-8-08',   name: 'Rack PDU 8-Outlet 230V 32A Surge',    categoryId: catPower.id,    unit: 'unit',         basePrice: 249,   taxRate: 8, isSubscription: false, description: '8x C13 outlets, 32A inlet C20, 1U, metered, surge protection, 1.8m cord' },
    { sku: 'PI-PDU-24-09',  name: 'Managed PDU 24-Outlet 3-Phase SNMP',  categoryId: catPower.id,    unit: 'unit',         basePrice: 899,   taxRate: 8, isSubscription: false, description: '24x C13, 3-phase input, outlet switching, SNMP, per-outlet metering, 0U' },
    { sku: 'PI-CABLE-TRY-10',name: 'Cable Tray 6ft Ladder Type Galv.',   categoryId: catPower.id,    unit: 'unit',         basePrice: 89,    taxRate: 8, isSubscription: false, description: '6ft (1.83m) ladder tray, galvanized steel, 12" wide, ceiling/wall mount' },
    { sku: 'PI-BLANK-11',   name: 'Blanking Panel Kit 42U Snap-In Steel',categoryId: catPower.id,    unit: 'kit',          basePrice: 49,    taxRate: 8, isSubscription: false, description: '42 blanking panels, 1U each, snap-in, brushed steel, airflow management' },
    { sku: 'PI-KVCONSOLE-12',name: 'KVM Console 1U LCD Drawer 17"',      categoryId: catPower.id,    unit: 'unit',         basePrice: 499,   taxRate: 8, isSubscription: false, description: '17" LCD, 1U slide-out, USB+PS/2 KVM, 1280x1024, integrated trackball' },
    { sku: 'PI-KVM16-13',   name: 'KVM Switch 16-Port IP Remote BIOS',   categoryId: catPower.id,    unit: 'unit',         basePrice: 999,   taxRate: 8, isSubscription: false, description: '16-port IP KVM, 2 remote users, BIOS access, virtual media, Java client' },
    { sku: 'PI-OHCM-14',    name: 'Overhead Cable Manager 2U Horizontal',categoryId: catPower.id,    unit: 'unit',         basePrice: 189,   taxRate: 8, isSubscription: false, description: '2U horizontal cable manager, 6" fingers, front + rear cable retention' },
    { sku: 'PI-FAN-15',     name: 'Rack Fan Tray 2U Thermostat 400CFM',  categoryId: catPower.id,    unit: 'unit',         basePrice: 149,   taxRate: 8, isSubscription: false, description: '2U rack fan tray, 4x 120mm fans, thermostat control, 400 CFM' },
    { sku: 'PI-SENSOR-16',  name: 'Environment Sensor Temp+Humidity SNMP',categoryId: catPower.id,   unit: 'unit',         basePrice: 99,    taxRate: 8, isSubscription: false, description: 'Temp+humidity sensor, SNMP, email alert, USB power, 1U rack mount' },
    { sku: 'PI-GEN-17',     name: 'Diesel Generator 20kVA 3-Phase ATS',  categoryId: catPower.id,    unit: 'unit',         basePrice: 7999,  taxRate: 8, isSubscription: false, description: '20kVA 3-phase, soundproof canopy, ATS ready, 100L tank, IP23' },
    { sku: 'PI-STS-18',     name: 'Static Transfer Switch 16A Single-Phase',categoryId: catPower.id, unit: 'unit',         basePrice: 1299,  taxRate: 8, isSubscription: false, description: '16A single-phase STS, <4ms transfer, dual-input, C19 outlet, 1U rack' },
    { sku: 'PI-GRND-19',    name: 'Server Room Raised Floor Box 4 Outlet',categoryId: catPower.id,   unit: 'unit',         basePrice: 189,   taxRate: 8, isSubscription: false, description: 'Raised floor box, 4x mains outlets, 2x Cat6 keystone, brushed aluminum' },
    { sku: 'PI-AIRCON-20',  name: 'Precision In-Row Air Conditioner 5kW',categoryId: catPower.id,    unit: 'unit',         basePrice: 4999,  taxRate: 8, isSubscription: false, description: 'In-row precision AC, 5kW cooling, EC fans, SNMP, hot/cold aisle compatible' },
  ];

  const productMap: Record<string, string> = {};
  for (const p of productDefs) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name, basePrice: p.basePrice, description: p.description ?? null },
      create: {
        sku: p.sku, name: p.name, categoryId: p.categoryId,
        unit: p.unit, basePrice: p.basePrice, taxRate: p.taxRate,
        isSubscription: p.isSubscription,
        recurringInterval: p.recurringInterval ?? null,
        description: p.description ?? null,
      },
    });
    productMap[p.sku] = product.id;
  }
  console.log(`  ✓ ${productDefs.length} products upserted`);

  // ── 4. Historical Quotations (co-purchase training data) ──────────────────
  console.log('  → Historical quotations (co-purchase training data)...');

  const bundles: Array<{ qn: string; lines: Array<{ sku: string; qty: number; disc: number }> }> = [
    { qn: 'H-0001', lines: [{ sku: 'LW-BIZ-14-01', qty: 10, disc: 5 }, { sku: 'PA-DOCK-12-05', qty: 10, disc: 3 }, { sku: 'PA-CAM-4K-06', qty: 10, disc: 3 }, { sku: 'PA-HSET-USB-07', qty: 10, disc: 5 }, { sku: 'CS-M365-STD-02', qty: 10, disc: 0 }, { sku: 'PS-SETUP-01', qty: 10, disc: 0 }] },
    { qn: 'H-0002', lines: [{ sku: 'LW-SLIM-14-04', qty: 5, disc: 5 }, { sku: 'MD-274K-03', qty: 5, disc: 5 }, { sku: 'PA-KBMS-BT-21', qty: 5, disc: 3 }, { sku: 'PA-DOCK-12-05', qty: 5, disc: 3 }, { sku: 'PA-HSET-BT-08', qty: 5, disc: 5 }, { sku: 'CS-M365-E3-03', qty: 5, disc: 0 }, { sku: 'CS-ADOBE-17', qty: 5, disc: 0 }] },
    { qn: 'H-0003', lines: [{ sku: 'SS-RACK1U-01', qty: 2, disc: 5 }, { sku: 'SS-NAS8-04', qty: 1, disc: 5 }, { sku: 'SS-SSD1T-09', qty: 8, disc: 3 }, { sku: 'PI-CAB42U-05', qty: 1, disc: 0 }, { sku: 'PI-UPS3000-03', qty: 2, disc: 0 }, { sku: 'PI-PDU-8-08', qty: 2, disc: 0 }, { sku: 'PS-SVRACK-03', qty: 1, disc: 0 }, { sku: 'PS-BACKUP-06', qty: 1, disc: 0 }] },
    { qn: 'H-0004', lines: [{ sku: 'NE-SW48G-02', qty: 2, disc: 5 }, { sku: 'NE-SW24POE-03', qty: 4, disc: 5 }, { sku: 'NE-AP-WIFI6-05', qty: 12, disc: 3 }, { sku: 'NE-FW-SMB-08', qty: 1, disc: 0 }, { sku: 'NE-PATCH24-13', qty: 4, disc: 5 }, { sku: 'PS-NETINST-02', qty: 1, disc: 0 }, { sku: 'PS-WIFI-12', qty: 1, disc: 0 }] },
    { qn: 'H-0005', lines: [{ sku: 'AV-BAR-01', qty: 3, disc: 5 }, { sku: 'MD-75CF-10', qty: 3, disc: 5 }, { sku: 'AV-DONGLE-11', qty: 3, disc: 3 }, { sku: 'CS-ZOOM-BIZ-13', qty: 15, disc: 0 }, { sku: 'CS-ZOOM-PHN-14', qty: 15, disc: 0 }, { sku: 'AV-WPS-01', qty: 3, disc: 5 }] },
    { qn: 'H-0006', lines: [{ sku: 'SEC-CAM4MP-04', qty: 16, disc: 5 }, { sku: 'SEC-NVR16-06', qty: 2, disc: 3 }, { sku: 'SEC-ACCESS-07', qty: 2, disc: 0 }, { sku: 'SEC-CARD-RD-08', qty: 10, disc: 3 }, { sku: 'NE-SW24POE-03', qty: 1, disc: 5 }, { sku: 'PS-NETINST-02', qty: 1, disc: 0 }] },
    { qn: 'H-0007', lines: [{ sku: 'LW-PRO-16-03', qty: 8, disc: 5 }, { sku: 'MD-27QHD-02', qty: 8, disc: 5 }, { sku: 'PA-DOCK-12-05', qty: 8, disc: 3 }, { sku: 'PA-KB-MECH-02', qty: 8, disc: 5 }, { sku: 'PA-MOUSE-ERG-03', qty: 8, disc: 5 }, { sku: 'CS-JIRA-24', qty: 8, disc: 0 }, { sku: 'CS-CNFL-25', qty: 8, disc: 0 }, { sku: 'CS-GWS-STD-07', qty: 8, disc: 0 }] },
    { qn: 'H-0008', lines: [{ sku: 'CS-M365-STD-02', qty: 50, disc: 5 }, { sku: 'CS-INTUNE-28', qty: 50, disc: 0 }, { sku: 'CS-AZURE-AAD-29', qty: 50, disc: 0 }, { sku: 'PS-MSFT-18', qty: 1, disc: 0 }, { sku: 'PS-CLOUD-04', qty: 1, disc: 0 }, { sku: 'CS-MDM-21', qty: 50, disc: 0 }] },
    { qn: 'H-0009', lines: [{ sku: 'LW-BIZ-15-02', qty: 20, disc: 5 }, { sku: 'MD-24FHD-01', qty: 20, disc: 5 }, { sku: 'PA-KBMS-01', qty: 20, disc: 5 }, { sku: 'PA-HUB-7IN1-04', qty: 20, disc: 3 }, { sku: 'PS-SETUP-01', qty: 20, disc: 0 }, { sku: 'CS-M365-BAS-01', qty: 20, disc: 0 }] },
    { qn: 'H-0010', lines: [{ sku: 'PI-UPS10K-04', qty: 2, disc: 0 }, { sku: 'PI-PDU-24-09', qty: 4, disc: 0 }, { sku: 'PI-AIRCON-20', qty: 2, disc: 0 }, { sku: 'PI-CAB42U-05', qty: 4, disc: 0 }, { sku: 'PI-SENSOR-16', qty: 4, disc: 0 }, { sku: 'PS-SVRACK-03', qty: 2, disc: 0 }] },
    { qn: 'H-0011', lines: [{ sku: 'LW-BIZ-14-01', qty: 15, disc: 3 }, { sku: 'PA-CAM-4K-06', qty: 15, disc: 3 }, { sku: 'PA-HSET-BT-08', qty: 15, disc: 5 }, { sku: 'CS-M365-STD-02', qty: 15, disc: 0 }, { sku: 'CS-ZOOM-BIZ-13', qty: 15, disc: 0 }, { sku: 'CS-VPN-BIZ-22', qty: 15, disc: 0 }, { sku: 'CS-PWD-23', qty: 15, disc: 0 }] },
    { qn: 'H-0012', lines: [{ sku: 'SS-TOWER-03', qty: 1, disc: 3 }, { sku: 'SS-NAS4-05', qty: 1, disc: 3 }, { sku: 'SS-HDD4TB-07', qty: 6, disc: 5 }, { sku: 'SS-RAM32-11', qty: 4, disc: 3 }, { sku: 'PI-UPS1500-02', qty: 2, disc: 0 }, { sku: 'CS-CBKP-20', qty: 2, disc: 0 }, { sku: 'PS-BACKUP-06', qty: 1, disc: 0 }] },
    { qn: 'H-0013', lines: [{ sku: 'SEC-FIDO-01', qty: 30, disc: 5 }, { sku: 'CS-AZURE-AAD-29', qty: 30, disc: 0 }, { sku: 'CS-EDR-19', qty: 30, disc: 0 }, { sku: 'CS-SIEM-30', qty: 30, disc: 0 }, { sku: 'PS-AUDIT-05', qty: 1, disc: 0 }, { sku: 'PS-PENTEST-19', qty: 1, disc: 0 }, { sku: 'PS-COMP-14', qty: 3, disc: 0 }] },
    { qn: 'H-0014', lines: [{ sku: 'LW-THIN-01-13', qty: 30, disc: 5 }, { sku: 'MD-24FHD-01', qty: 30, disc: 5 }, { sku: 'PA-HSET-USB-07', qty: 30, disc: 5 }, { sku: 'PA-PHONE-IP-17', qty: 10, disc: 3 }, { sku: 'NE-SW24G-01', qty: 2, disc: 3 }, { sku: 'CS-ZOOM-PHN-14', qty: 30, disc: 0 }] },
    { qn: 'H-0015', lines: [{ sku: 'NE-AP-WIFI6E-06', qty: 20, disc: 5 }, { sku: 'NE-CTRL-12', qty: 1, disc: 3 }, { sku: 'NE-SW24POE-03', qty: 2, disc: 5 }, { sku: 'PS-WIFI-12', qty: 1, disc: 0 }, { sku: 'PS-NETINST-02', qty: 1, disc: 0 }] },
    { qn: 'H-0016', lines: [{ sku: 'AV-DWB-65-04', qty: 1, disc: 3 }, { sku: 'AV-CAM4K-01', qty: 1, disc: 3 }, { sku: 'AV-MIC-CEIL-05', qty: 2, disc: 3 }, { sku: 'AV-AMP-06', qty: 1, disc: 0 }, { sku: 'AV-WPS-01', qty: 1, disc: 3 }, { sku: 'MD-75CF-10', qty: 1, disc: 5 }, { sku: 'CS-ZOOM-BIZ-13', qty: 20, disc: 0 }] },
    { qn: 'H-0017', lines: [{ sku: 'CS-MDM-21', qty: 100, disc: 0 }, { sku: 'CS-INTUNE-28', qty: 100, disc: 0 }, { sku: 'CS-AV-EPT-18', qty: 100, disc: 0 }, { sku: 'CS-VPN-BIZ-22', qty: 100, disc: 0 }, { sku: 'SEC-FIDO-01', qty: 100, disc: 5 }, { sku: 'PS-TRAIN-10', qty: 2, disc: 0 }] },
    { qn: 'H-0018', lines: [{ sku: 'LW-MBIZ-15-05', qty: 6, disc: 5 }, { sku: 'MD-27OLED-12', qty: 6, disc: 5 }, { sku: 'MD-STAND-06', qty: 6, disc: 3 }, { sku: 'PA-DOCK-12-05', qty: 6, disc: 3 }, { sku: 'CS-ADOBE-17', qty: 6, disc: 0 }, { sku: 'CS-DBX-BIZ-15', qty: 6, disc: 0 }, { sku: 'PS-SETUP-01', qty: 6, disc: 0 }] },
    { qn: 'H-0019', lines: [{ sku: 'NE-RTR-ENT-10', qty: 1, disc: 0 }, { sku: 'NE-SW24G-01', qty: 1, disc: 3 }, { sku: 'NE-AP-WIFI6-05', qty: 4, disc: 3 }, { sku: 'NE-FW-SMB-08', qty: 1, disc: 0 }, { sku: 'PI-UPS1500-02', qty: 1, disc: 0 }, { sku: 'LW-BIZ-14-01', qty: 8, disc: 5 }, { sku: 'CS-M365-STD-02', qty: 8, disc: 0 }, { sku: 'PS-NETINST-02', qty: 1, disc: 0 }] },
    { qn: 'H-0020', lines: [{ sku: 'LW-CHRM-14-07', qty: 40, disc: 5 }, { sku: 'CS-M365-F1-27', qty: 40, disc: 0 }, { sku: 'CS-MDM-21', qty: 40, disc: 0 }, { sku: 'CS-AV-EPT-18', qty: 40, disc: 0 }, { sku: 'PA-CAM-HD-11', qty: 20, disc: 3 }, { sku: 'PS-TRAIN-10', qty: 2, disc: 0 }] },
  ];

  let quotaCreated = 0;
  for (const bundle of bundles) {
    const existing = await prisma.quotation.findUnique({ where: { quoteNumber: bundle.qn } });
    if (existing) { console.log(`    Skipping ${bundle.qn} (already exists)`); continue; }

    let subtotal = 0, discountTotal = 0, taxTotal = 0, grandTotal = 0, marginAmount = 0;
    const linesData: any[] = [];

    for (const l of bundle.lines) {
      const pid = productMap[l.sku];
      if (!pid) { console.warn(`    SKU not found: ${l.sku}`); continue; }
      const prod = productDefs.find(p => p.sku === l.sku)!;
      const c = calcLine(prod.basePrice, l.qty, l.disc, prod.taxRate);
      subtotal += prod.basePrice * l.qty;
      discountTotal += c.discountAmount;
      taxTotal += c.taxAmount;
      grandTotal += c.lineTotal + c.taxAmount;
      marginAmount += c.estimatedMarginAmount;
      linesData.push({
        productId: pid, descriptionSnapshot: prod.name, skuSnapshot: l.sku,
        quantity: l.qty, unitPrice: prod.basePrice, discountPercent: l.disc,
        allowedDiscountPercent: 15, discountAmount: c.discountAmount, taxAmount: c.taxAmount,
        lineTotal: c.lineTotal, estimatedUnitCost: c.estimatedUnitCost,
        estimatedMarginAmount: c.estimatedMarginAmount, estimatedMarginPercent: c.estimatedMarginPercent,
        discountOveragePercent: 0,
      });
    }

    const marginPercent = grandTotal > 0 ? +((marginAmount / grandTotal) * 100).toFixed(4) : 0;
    await prisma.quotation.create({
      data: {
        quoteNumber: bundle.qn,
        customerId: quotaCreated % 2 === 0 ? acme.id : beta.id,
        salesRepId: rep.id,
        status: 'CONFIRMED',
        currencyCode: 'USD',
        subtotal: +subtotal.toFixed(2), discountTotal: +discountTotal.toFixed(2),
        taxTotal: +taxTotal.toFixed(2), grandTotal: +grandTotal.toFixed(2),
        marginAmount: +marginAmount.toFixed(2), marginPercent,
        confirmedAt: new Date(Date.now() - (quotaCreated + 1) * 6 * 24 * 60 * 60 * 1000),
        lines: { create: linesData },
      },
    });
    quotaCreated++;
  }
  console.log(`  ✓ ${quotaCreated} historical quotations created`);

  console.log('\n✅ Catalog seed complete!');
  console.log(`   Products: ${productDefs.length} across 10 categories`);
  console.log(`   Historical quotations: ${quotaCreated} (co-purchase training data)`);
  console.log('\n   Recommendation engine examples:');
  console.log('   + Add Laptop → recommends: Dock, Webcam, Headset, M365, Setup Service');
  console.log('   + Add Switch → recommends: APs, Firewall, Patch Panel, Network Install');
  console.log('   + Add Server → recommends: NAS, SSD, UPS, Rack, Backup Service');
  console.log('   + Add Conference Camera → recommends: Speakerphone, Video Bar, Zoom');
}

main()
  .catch((e) => { console.error('Catalog seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
