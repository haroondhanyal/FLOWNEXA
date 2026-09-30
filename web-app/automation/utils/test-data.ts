import { faker } from "@faker-js/faker";

// FAKER DATA: unique readable labels stop parallel test runs colliding with one another.
export function uniqueName(prefix: string) { return `${prefix} ${faker.string.alphanumeric(8).toUpperCase()}`; }
export function fakeTask() { return { title: uniqueName("QA task"), description: faker.lorem.sentence(), priority: faker.helpers.arrayElement(["Low", "Medium", "High"]), dueDate: faker.date.soon({ days: 21 }).toISOString().slice(0, 10) }; }
export function fakeProject() { return { name: uniqueName("QA project"), description: faker.lorem.sentences(2), dueDate: faker.date.soon({ days: 60 }).toISOString() }; }
export function invalidEmail() { return `${faker.string.alphanumeric(10)}.${faker.string.alphanumeric(5)}`; }
