const request = require("supertest");
const app = require("./src/service");

let dinerToken;

beforeAll(async () => {
  const diner = {
    name: "diner tester",
    email: Math.random().toString(36).substring(2, 12) + "@test.com",
    password: "pass",
  };
  const regRes = await request(app).post("/api/auth").send(diner);
  dinerToken = regRes.body.token;
});

test("get pizza menu", async () => {
  const res = await request(app).get("/api/order/menu");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test("get user orders", async () => {
  const res = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${dinerToken}`);
  expect(res.status).toBe(200);
  expect(res.body.orders).toBeDefined();
});

test("add menu item unauthorized for regular diner", async () => {
  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${dinerToken}`)
    .send({ title: "Pizza", price: 10 });
  expect(res.status).toBe(403);
});

test("admin can add item to menu", async () => {
  const adminRes = await request(app)
    .put("/api/auth")
    .send({ email: "a@jwt.com", password: "admin" });
  const adminToken = adminRes.body.token;

  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: "Veggie Delight",
      description: "Mushrooms and peppers",
      image: "pizza1.png",
      price: 0.005,
    });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

