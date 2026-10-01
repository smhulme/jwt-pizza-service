const request = require("supertest");
const app = require("./src/service");

let userToken;
let user;

beforeAll(async () => {
  const testUser = {
    name: "user tester",
    email: Math.random().toString(36).substring(2, 12) + "@test.com",
    password: "pass",
  };
  const regRes = await request(app).post("/api/auth").send(testUser);
  userToken = regRes.body.token;
  user = regRes.body.user;
});

test("get current user", async () => {
  const res = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body.email).toBe(user.email);
});

test("get current user unauthorized without token", async () => {
  const res = await request(app).get("/api/user/me");
  expect(res.status).toBe(401);
});

test("update user email, name, and password", async () => {
  const newName = "Updated Name";
  const newEmail = "updated-" + user.email;
  const newPassword = "newpassword123";

  const res = await request(app)
    .put(`/api/user/${user.id}`)
    .set("Authorization", `Bearer ${userToken}`)
    .send({ name: newName, email: newEmail, password: newPassword });
  expect(res.status).toBe(200);
  expect(res.body.user.email).toBe(newEmail);
  expect(res.body.user.name).toBe(newName);
  expect(res.body.token).toBeDefined();

  // Verify can login with the new password
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: newEmail, password: newPassword });
  expect(loginRes.status).toBe(200);
});

test("update user unauthorized for different user as regular diner", async () => {
  const res = await request(app)
    .put(`/api/user/${user.id + 9999}`)
    .set("Authorization", `Bearer ${userToken}`)
    .send({ email: "unauth@test.com" });
  expect(res.status).toBe(403);
});

test("update user unauthorized without token", async () => {
  const res = await request(app)
    .put(`/api/user/${user.id}`)
    .send({ email: "unauth@test.com" });
  expect(res.status).toBe(401);
});

test("admin can update another user", async () => {
  const adminRes = await request(app)
    .put("/api/auth")
    .send({ email: "a@jwt.com", password: "admin" });
  const adminToken = adminRes.body.token;

  const res = await request(app)
    .put(`/api/user/${user.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email: "updated-" + user.email, name: "Admin Renamed User" });
  expect(res.status).toBe(200);
  expect(res.body.user.name).toBe("Admin Renamed User");
});

test("delete user not implemented", async () => {
  const res = await request(app)
    .delete(`/api/user/${user.id}`)
    .set("Authorization", `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe("not implemented");
});

test("delete user unauthorized without token", async () => {
  const res = await request(app).delete(`/api/user/${user.id}`);
  expect(res.status).toBe(401);
});

test("list users not implemented", async () => {
  const res = await request(app)
    .get("/api/user")
    .set("Authorization", `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe("not implemented");
  expect(res.body.users).toEqual([]);
  expect(res.body.more).toBe(false);
});

test("list users unauthorized without token", async () => {
  const res = await request(app).get("/api/user");
  expect(res.status).toBe(401);
});
