const request = require("supertest");
const app = require("./src/service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("logout", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");
});

test("logout without token returns 401", async () => {
  const res = await request(app).delete("/api/auth");
  expect(res.status).toBe(401);
});

test("register missing fields returns 400", async () => {
  const res = await request(app).post("/api/auth").send({ name: "no-email" });
  expect(res.status).toBe(400);
});

test("get root welcome message", async () => {
  const res = await request(app).get("/");
  expect(res.status).toBe(200);
  expect(res.body.message).toBe("welcome to JWT Pizza");
});

test("get api docs", async () => {
  const res = await request(app).get("/api/docs");
  expect(res.status).toBe(200);
  expect(res.body.endpoints).toBeDefined();
});

test("unknown endpoint returns 404", async () => {
  const res = await request(app).get("/random-unknown-endpoint");
  expect(res.status).toBe(404);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}
