const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

const extractCSRFToken = (html) => {
  const $ = cheerio.load(html);
  return $("[name=_csrf]").val();
};

const login = async (agentt, email, password) => {
  const res = await agentt.get("/login");
  const csrfToken = extractCSRFToken(res.text);
  const a = await agentt.post("/session").send({
    email,
    password,
    _csrf: csrfToken,
  });
  console.log(a.statusCode);
  return a;
};

describe("Todo test cases", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(5000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/login");
    let csrfToken = extractCSRFToken(res.text);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "password",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
    res = await agent.get("/login");
    csrfToken = extractCSRFToken(res.text);
    res = await agent.post("/users").send({
      firstName: "Akss",
      lastName: "D",
      email: "user123@example.com",
      password: "123456789",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign out", async () => {
    let res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  });

  test("Creates a todo", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "password");
    const { text } = await agent.get("/todos");
    const csrfToken = extractCSRFToken(text);

    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Marks a todo with the given ID as complete", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "password");
    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);
    await agent.post("/todos").send({
      title: "Write assignment",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const groupedTodos = await agent
      .get("/alltodos")
      .set("Accept", "application/json");
    const parsedResponse = JSON.parse(groupedTodos.text);
    const lastItem = parsedResponse[parsedResponse.length - 1];

    res = await agent.get("/todos");
    csrfToken = extractCSRFToken(res.text);

    const markCompleteResponse = await agent.put(`/todos/${lastItem.id}`).send({
      _csrf: csrfToken,
      completed: true,
    });

    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(true);
  });

  test("Marks a todo with the given ID as incomplete", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "password");
    const groupedTodos = await agent
      .get("/alltodos")
      .set("Accept", "application/json");
    const parsedResponse = JSON.parse(groupedTodos.text);
    const completeItem = parsedResponse.find((item) => item.completed === true);

    const res = await agent.get("/todos");
    const csrfToken = extractCSRFToken(res.text);

    const markIncompleteResponse = await agent
      .put(`/todos/${completeItem.id}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });

    const parsedIncompleteResponse = JSON.parse(markIncompleteResponse.text);
    expect(parsedIncompleteResponse.completed).toBe(false);
  });

  test("Deletes a todo with the given ID", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "password");
    let res = await agent.get("/todos");
    let csrfToken = extractCSRFToken(res.text);

    await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const response = await agent.get("/alltodos");
    const parsedResponse = JSON.parse(response.text);

    const todoID = parsedResponse[parsedResponse.length - 1].id;

    res = await agent.get("/todos");
    csrfToken = extractCSRFToken(res.text);

    const deleteResponse = await agent.delete(`/todos/${todoID}`).send({
      _csrf: csrfToken,
    });
    console.log(deleteResponse.text);
    expect(deleteResponse.statusCode).toBe(200);

    const reresponse = await agent.get("/alltodos");
    const reresponseParsed = JSON.parse(reresponse.text);
    expect(reresponseParsed.length).toBe(parsedResponse.length - 1);
    expect(reresponseParsed.find((todo) => todo.id === todoID)).toBe(undefined);
  });
});
