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

test("update user", async () => {
  const res = await request(app)
    .put(`/api/user/${user.id}`)
    .set("Authorization", `Bearer ${userToken}`)
    .send({ email: "updated-" + user.email });
  expect(res.status).toBe(200);
  expect(res.body.user.email).toBe("updated-" + user.email);
});

test("update user unauthorized for different user", async () => {
  const res = await request(app)
    .put(`/api/user/${user.id + 9999}`)
    .set("Authorization", `Bearer ${userToken}`)
    .send({ email: "unauth@test.com" });
  expect(res.status).toBe(403);
});

test("delete user not implemented", async () => {
  const res = await request(app)
    .delete(`/api/user/${user.id}`)
    .set("Authorization", `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe("not implemented");
});

test("list users not implemented", async () => {
  const res = await request(app)
    .get("/api/user")
    .set("Authorization", `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe("not implemented");
});
