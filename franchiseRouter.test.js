const request = require("supertest");
const app = require("./src/service");

let token;
let user;

beforeAll(async () => {
  const testUser = {
    name: "franchise user",
    email: Math.random().toString(36).substring(2, 12) + "@test.com",
    password: "pass",
  };
  const regRes = await request(app).post("/api/auth").send(testUser);
  token = regRes.body.token;
  user = regRes.body.user;
});

test("get franchises list", async () => {
  const res = await request(app).get("/api/franchise");
  expect(res.status).toBe(200);
  expect(res.body.franchises).toBeDefined();
});

test("get user franchises", async () => {
  const res = await request(app)
    .get(`/api/franchise/${user.id}`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test("create franchise forbidden for regular diner", async () => {
  const res = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "My Franchise", admins: [] });
  expect(res.status).toBe(403);
});

test("create store forbidden when franchise not found / not admin", async () => {
  const res = await request(app)
    .post("/api/franchise/999999/store")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "SLC" });
  expect(res.status).toBe(403);
});

test("delete store forbidden when franchise not found / not admin", async () => {
  const res = await request(app)
    .delete("/api/franchise/999999/store/1")
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(403);
});

test("admin can create franchise, add store, and delete them", async () => {
  const adminRes = await request(app)
    .put("/api/auth")
    .send({ email: "a@jwt.com", password: "admin" });
  const adminToken = adminRes.body.token;

  // Create franchise
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "TestFranchise-" + Math.random().toString(36).substring(2, 7),
      admins: [{ email: "a@jwt.com" }],
    });
  expect(createRes.status).toBe(200);
  const franchiseId = createRes.body.id;

  // Create store
  const storeRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Downtown" });
  expect(storeRes.status).toBe(200);
  const storeId = storeRes.body.id;

  // Delete store
  const delStoreRes = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  expect(delStoreRes.status).toBe(200);
  expect(delStoreRes.body.message).toBe("store deleted");

  // Delete franchise
  const delFranchiseRes = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set("Authorization", `Bearer ${adminToken}`);
  expect(delFranchiseRes.status).toBe(200);
  expect(delFranchiseRes.body.message).toBe("franchise deleted");
});

