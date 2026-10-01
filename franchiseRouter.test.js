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
  expect(Array.isArray(res.body.franchises)).toBe(true);
});

test("get franchises list with pagination and filter", async () => {
  const res = await request(app).get("/api/franchise?page=0&limit=3&name=*");
  expect(res.status).toBe(200);
  expect(res.body.franchises).toBeDefined();
  expect(Array.isArray(res.body.franchises)).toBe(true);
  expect(res.body.franchises.length).toBeLessThanOrEqual(3);
});

test("get user franchises", async () => {
  const res = await request(app)
    .get(`/api/franchise/${user.id}`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test("get other user franchises as diner returns empty list", async () => {
  const res = await request(app)
    .get(`/api/franchise/${user.id + 9999}`)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});

test("get user franchises unauthorized without token", async () => {
  const res = await request(app).get(`/api/franchise/${user.id}`);
  expect(res.status).toBe(401);
});

test("create franchise unauthorized without token", async () => {
  const res = await request(app).post("/api/franchise").send({ name: "Unauth" });
  expect(res.status).toBe(401);
});

test("create franchise forbidden for regular diner", async () => {
  const res = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "My Franchise", admins: [] });
  expect(res.status).toBe(403);
});

test("create store unauthorized without token", async () => {
  const res = await request(app).post("/api/franchise/1/store").send({ name: "SLC" });
  expect(res.status).toBe(401);
});

test("create store forbidden when franchise not found / not admin", async () => {
  const res = await request(app)
    .post("/api/franchise/999999/store")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "SLC" });
  expect(res.status).toBe(403);
});

test("delete store unauthorized without token", async () => {
  const res = await request(app).delete("/api/franchise/1/store/1");
  expect(res.status).toBe(401);
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

test("franchisee can create store in own franchise and delete it", async () => {
  const adminRes = await request(app)
    .put("/api/auth")
    .send({ email: "a@jwt.com", password: "admin" });
  const adminToken = adminRes.body.token;

  // Register dedicated franchisee user
  const franchisee = {
    name: "Franchisee User",
    email: Math.random().toString(36).substring(2, 12) + "@franchisee.com",
    password: "pass",
  };
  await request(app).post("/api/auth").send(franchisee);

  // Admin creates franchise with this franchisee
  const fRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "FranchiseeCorp-" + Math.random().toString(36).substring(2, 7),
      admins: [{ email: franchisee.email }],
    });
  expect(fRes.status).toBe(200);
  const fId = fRes.body.id;

  // Login as franchisee to get token with updated permissions
  const fLoginRes = await request(app).put("/api/auth").send(franchisee);
  const fToken = fLoginRes.body.token;

  // Franchisee creates store in their franchise
  const storeRes = await request(app)
    .post(`/api/franchise/${fId}/store`)
    .set("Authorization", `Bearer ${fToken}`)
    .send({ name: "FranchiseeStore" });
  expect(storeRes.status).toBe(200);
  const storeId = storeRes.body.id;

  // Franchisee cannot create store in another franchise
  const badStoreRes = await request(app)
    .post("/api/franchise/999999/store")
    .set("Authorization", `Bearer ${fToken}`)
    .send({ name: "BadStore" });
  expect(badStoreRes.status).toBe(403);

  // Franchisee deletes store from their franchise
  const delStoreRes = await request(app)
    .delete(`/api/franchise/${fId}/store/${storeId}`)
    .set("Authorization", `Bearer ${fToken}`);
  expect(delStoreRes.status).toBe(200);
  expect(delStoreRes.body.message).toBe("store deleted");

  // Clean up franchise
  await request(app)
    .delete(`/api/franchise/${fId}`)
    .set("Authorization", `Bearer ${adminToken}`);
});

