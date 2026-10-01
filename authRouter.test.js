const request = require("supertest");
const jwt = require("jsonwebtoken");
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

test("login with wrong password returns 404", async () => {
  const res = await request(app)
    .put("/api/auth")
    .send({ email: testUser.email, password: "wrongpassword" });
  expect(res.status).toBe(404);
});

test("login with non-existent user returns 404", async () => {
  const res = await request(app)
    .put("/api/auth")
    .send({ email: "doesnotexist_" + Date.now() + "@test.com", password: "pass" });
  expect(res.status).toBe(404);
});

test("logout with valid token", async () => {
  const tempUser = {
    name: "logout tester",
    email: Math.random().toString(36).substring(2, 12) + "@test.com",
    password: "pass",
  };
  const regRes = await request(app).post("/api/auth").send(tempUser);
  const tempToken = regRes.body.token;

  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${tempToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");
});

test("logout without token returns 401", async () => {
  const res = await request(app).delete("/api/auth");
  expect(res.status).toBe(401);
});

test("request with malformed token returns 401", async () => {
  const res = await request(app)
    .delete("/api/auth")
    .set("Authorization", "Bearer not-a-valid-token");
  expect(res.status).toBe(401);
});

test("token verification failure sets user to null and returns 401", async () => {
  const verifySpy = jest.spyOn(jwt, "verify").mockImplementationOnce(() => {
    throw new Error("verification failed");
  });

  const res = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(401);
  verifySpy.mockRestore();
});

test("register missing fields returns 400", async () => {
  const resNoEmail = await request(app).post("/api/auth").send({ name: "no-email" });
  expect(resNoEmail.status).toBe(400);

  const resNoPassword = await request(app)
    .post("/api/auth")
    .send({ name: "no-pass", email: "nopass@test.com" });
  expect(resNoPassword.status).toBe(400);

  const resNoName = await request(app)
    .post("/api/auth")
    .send({ email: "noname@test.com", password: "pass" });
  expect(resNoName.status).toBe(400);
});

test("get root welcome message", async () => {
  const res = await request(app).get("/");
  expect(res.status).toBe(200);
  expect(res.body.message).toBe("welcome to JWT Pizza");
  expect(res.body.version).toBeDefined();
});

test("get api docs", async () => {
  const res = await request(app).get("/api/docs");
  expect(res.status).toBe(200);
  expect(res.body.endpoints).toBeDefined();
  expect(Array.isArray(res.body.endpoints)).toBe(true);
});

test("unknown endpoint returns 404", async () => {
  const res = await request(app).get("/random-unknown-endpoint");
  expect(res.status).toBe(404);
  expect(res.body.message).toBe("unknown endpoint");
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}
