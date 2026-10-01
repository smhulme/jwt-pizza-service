const request = require("supertest");
const app = require("./src/service");
const { DB } = require("./src/database/database");

let dinerToken;
let menuItemId;
const originalFetch = global.fetch;

beforeAll(async () => {
  const diner = {
    name: "diner tester",
    email: Math.random().toString(36).substring(2, 12) + "@test.com",
    password: "pass",
  };
  const regRes = await request(app).post("/api/auth").send(diner);
  dinerToken = regRes.body.token;

  let menuRes = await request(app).get("/api/order/menu");
  if (menuRes.body.length === 0) {
    await DB.addMenuItem({
      title: "Student",
      description: "No topping, no sauce, just crust",
      image: "pizza9.png",
      price: 0.0001,
    });
    menuRes = await request(app).get("/api/order/menu");
  }
  menuItemId = menuRes.body[0].id;
}, 30000);

afterAll(() => {
  global.fetch = originalFetch;
});

test("get pizza menu", async () => {
  const res = await request(app).get("/api/order/menu");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});

test("get user orders", async () => {
  const res = await request(app)
    .get("/api/order")
    .set("Authorization", `Bearer ${dinerToken}`);
  expect(res.status).toBe(200);
  expect(res.body.orders).toBeDefined();
  expect(Array.isArray(res.body.orders)).toBe(true);
});

test("get user orders unauthorized without token", async () => {
  const res = await request(app).get("/api/order");
  expect(res.status).toBe(401);
});

test("add menu item unauthorized without token", async () => {
  const res = await request(app)
    .put("/api/order/menu")
    .send({ title: "Pizza", price: 10 });
  expect(res.status).toBe(401);
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

  const newItem = {
    title: "Veggie Delight " + Math.random().toString(36).substring(2, 7),
    description: "Mushrooms and peppers",
    image: "pizza1.png",
    price: 0.005,
  };

  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(newItem);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.some((item) => item.title === newItem.title)).toBe(true);
});

test("create order unauthorized without token", async () => {
  const res = await request(app).post("/api/order").send({});
  expect(res.status).toBe(401);
});

test("create order succeeds when factory fulfills", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      reportUrl: "http://factory.test/report/success",
      jwt: "mocked-factory-jwt",
    }),
  });

  const orderReq = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: menuItemId, description: "Veggie", price: 0.05 }],
  };

  const res = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${dinerToken}`)
    .send(orderReq);

  expect(res.status).toBe(200);
  expect(res.body.order).toBeDefined();
  expect(res.body.order.id).toBeDefined();
  expect(res.body.jwt).toBe("mocked-factory-jwt");
  expect(res.body.followLinkToEndChaos).toBe("http://factory.test/report/success");
});

test("create order returns 500 when factory fails", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({
      reportUrl: "http://factory.test/report/fail",
    }),
  });

  const orderReq = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: menuItemId, description: "Veggie", price: 0.05 }],
  };

  const res = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${dinerToken}`)
    .send(orderReq);

  expect(res.status).toBe(500);
  expect(res.body.message).toBe("Failed to fulfill order at factory");
  expect(res.body.followLinkToEndChaos).toBe("http://factory.test/report/fail");
});

test("unexpected error without statusCode triggers default 500 handler", async () => {
  const spy = jest
    .spyOn(DB, "getMenu")
    .mockRejectedValueOnce(new Error("Unexpected failure"));
  const res = await request(app).get("/api/order/menu");
  expect(res.status).toBe(500);
  expect(res.body.message).toBe("Unexpected failure");
  spy.mockRestore();
});

