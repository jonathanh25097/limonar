/**
 * Loads the starting data: the people from the chats, lemon products and the
 * customers in the mockups. Safe to run twice — it upserts by phone, product
 * code and customer name.
 *
 *   npm run seed            (reads .env.local)
 *
 * Every user gets the PIN in SEED_PIN (default 1234). Phones are placeholders:
 * change them to the real numbers before anyone signs in for real.
 */
import { hashPin } from "@/server/auth/password";
import { collections, newId } from "@/server/db/collections";
import { getClient, getDb } from "@/server/db/mongo";
import { productCode } from "@/core/catalog/product";
import type { Role } from "@/core/auth/roles";

const USERS: { name: string; phone: string; roles: Role[] }[] = [
  { name: "María Isabel", phone: "50580000001", roles: ["owner"] },
  { name: "Adrián", phone: "50580000002", roles: ["owner"] },
  { name: "Ivania", phone: "50580000003", roles: ["office", "seller"] },
  { name: "Guillermo", phone: "50580000004", roles: ["field"] },
  { name: "Sonia", phone: "50580000005", roles: ["seller"] },
  { name: "Mauricio Hernández", phone: "50580000006", roles: ["buyer"] },
  { name: "Chayito", phone: "50580000007", roles: ["agent"] },
];

const VARIETIES = { persa: ["perza", "tahití", "sin semilla"], criollo: [] as string[] };
const GRADES = ["jumbo", "primera", "manchado", "rechazado"];

const main = async () => {
  const db = await getDb();
  const c = collections(db);
  const pin = await hashPin(process.env.SEED_PIN ?? "1234");
  const now = new Date();

  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const res = await c.users.findOneAndUpdate(
      { phone: u.phone },
      {
        $set: { name: u.name, roles: u.roles, active: true },
        $setOnInsert: { _id: newId(), phone: u.phone, pinHash: pin, createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    userIds[u.name] = res!._id;
  }

  for (const [variety, aliases] of Object.entries(VARIETIES)) {
    for (const grade of GRADES) {
      const name = `${variety[0].toUpperCase()}${variety.slice(1)} ${grade}`;
      await c.products.updateOne(
        { divisionId: "lemons", code: productCode([variety, grade]) },
        {
          $set: { name, unit: "unit", attributes: { variety, grade }, aliases, active: true },
          $setOnInsert: { _id: newId(), createdAt: now, createdBy: "system" },
        },
        { upsert: true },
      );
    }
  }

  const customers = [
    {
      name: "Doña Tina · Mercado Central",
      type: "retail",
      paymentRule: "on_delivery",
      defaultDeliveryPoint: "Mercado Central",
    },
    {
      name: "Ing. Mauricio Hernández",
      type: "wholesale",
      paymentRule: "after_count",
      linkedUserId: userIds["Mauricio Hernández"],
    },
    { name: "Sonia · Vía Vía", type: "retail", paymentRule: "on_delivery", defaultDeliveryPoint: "Vía Vía" },
  ] as const;
  for (const cust of customers) {
    await c.customers.updateOne(
      { name: cust.name },
      {
        $set: { ...cust, divisionIds: ["lemons"], active: true },
        $setOnInsert: { _id: newId(), createdAt: now, createdBy: "system" },
      },
      { upsert: true },
    );
  }

  console.log(`Seeded ${USERS.length} users, ${GRADES.length * 2} products, ${customers.length} customers.`);
};

main()
  .then(async () => (await getClient()).close())
  .catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
    (await getClient().catch(() => null))?.close();
  });
