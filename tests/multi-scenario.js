"use strict";
// The checks for several adults per child and a child in more than one class. They are run against the Node server (tests/api-multi.js) and
// against the Cloudflare worker (tests/worker-multi.js), so both have to behave in the same way.
module.exports = async function scenario(who, TEACHER_CODE, ok) {
  const T = who(), C = who(), C2 = who(), Lo = who(), Mo = who();
  const names = (r) => r.json.students.map((s) => s.name).sort().join(",");

  // a teacher with a school class, and a caregiver with a family
  let r = await T.call("POST", "/api/register", { role: "teacher", username: "multiT", displayName: "Fröken Multi", password: "hemligt-123", teacherCode: TEACHER_CODE });
  const school = (await T.call("POST", "/api/teacher/classes", { name: "4B" })).json["class"];
  ok(school.guideCode && school.guideCode !== school.code && school.owner === true, "a class has a code for adults of its own, shown to its owner");
  r = await C.call("POST", "/api/register", { role: "caregiver", username: "multiC", displayName: "Maria Multi", password: "hemligt-123" });
  const family = (await C.call("GET", "/api/teacher/classes")).json.classes[0];
  ok(family.owner && family.guideCode && family.guides.length === 1 && family.guides[0].you, "the family has its owner as the first guide");

  // a child joins the school class and then the family
  r = await Lo.call("POST", "/api/register", { role: "student", username: "multiLo", displayName: "Lo Multi", password: "hemligt-123", classCode: school.code });
  ok(r.status === 201 && r.json.user.classes.length === 1 && r.json.user.guide === "teacher", "a child joins the school class");
  r = await Lo.call("POST", "/api/me/classes", { classCode: "FEL123" });
  ok(r.status === 400, "a wrong code is refused");
  r = await Lo.call("POST", "/api/me/classes", { classCode: family.code });
  ok(r.status === 200 && r.json.user.classes.length === 2 && r.json.user.guide === "both" && r.json.user.className === "4B · Familjen Multi", "and then the family: two classes, and a guide that is both");
  r = await Lo.call("POST", "/api/me/classes", { classCode: family.code });
  ok(r.status === 200 && r.json.user.classes.length === 2, "joining the same class twice changes nothing");
  r = await Lo.call("GET", "/api/me");
  ok(r.json.user.classes.length === 2, "/api/me tells the classes");

  // each adult sees the child, with the classes they share
  r = await T.call("GET", "/api/teacher/students");
  ok(names(r) === "Lo Multi" && r.json.students[0].class === "4B" && r.json.students[0].classIds.length === 1, "the teacher sees the child, in the school class only");
  r = await C.call("GET", "/api/teacher/students");
  ok(names(r) === "Lo Multi" && r.json.students[0].class === "Familjen Multi", "the caregiver sees the child, in the family only");
  const loId = r.json.students[0].id;

  // cheers and messages stay in their own class
  await T.call("POST", "/api/teacher/feedback", { studentId: loId, text: "Bra i skolan", sticker: "star" });
  await C.call("POST", "/api/teacher/feedback", { studentId: loId, text: "Bra hemma" });
  r = await Lo.call("GET", "/api/me/data");
  ok(r.json.feedback.length === 2, "the child gets the cheers of both");
  r = await T.call("GET", "/api/teacher/students");
  ok(r.json.students[0].feedback.length === 1 && r.json.students[0].feedback[0].text === "Bra i skolan", "the teacher sees only the cheer from the school");
  r = await C.call("GET", "/api/teacher/students");
  ok(r.json.students[0].feedback.length === 1 && r.json.students[0].feedback[0].text === "Bra hemma", "the caregiver sees only the cheer from home");

  // assignments: the child sees both, each adult sees their own class
  await T.call("POST", "/api/teacher/assignments", { classId: school.id, lessonId: "addition", note: "Från skolan" });
  await C.call("POST", "/api/teacher/assignments", { classId: family.id, studentId: loId, lessonId: "subtraktion", note: "Hemma" });
  r = await Lo.call("GET", "/api/me/data");
  ok(r.json.assignments.length === 2, "the child has the assignments of both");
  r = await T.call("GET", "/api/teacher/assignments");
  ok(r.json.assignments.length === 1 && r.json.assignments[0].note === "Från skolan", "the teacher sees the assignment from the school");
  r = await T.call("POST", "/api/teacher/assignments", { classId: family.id, lessonId: "addition" });
  ok(r.status === 400, "the teacher cannot give an assignment in the family");

  // a second parent joins the family with the code for adults, at sign-up
  r = await C2.call("POST", "/api/register", { role: "caregiver", username: "multiC2", displayName: "Per Multi", password: "hemligt-123", guideCode: "VFELFELFEL" });
  ok(r.status === 400, "a wrong code for adults is refused");
  r = await C2.call("POST", "/api/register", { role: "caregiver", username: "multiC2", displayName: "Per Multi", password: "hemligt-123", guideCode: family.guideCode });
  ok(r.status === 201, "the other parent signs up with the code for adults");
  r = await C2.call("GET", "/api/teacher/classes");
  ok(r.json.classes.length === 1 && r.json.classes[0].id === family.id && r.json.classes[0].owner === false && r.json.classes[0].guideCode === null && r.json.classes[0].guides.length === 2,
    "and shares the family, without owning it (no code for adults to hand out), and without a family of their own");
  r = await C2.call("GET", "/api/teacher/students");
  ok(names(r) === "Lo Multi" && r.json.students[0].feedback.length === 1, "sees the child and the cheer the other parent sent");
  r = await C2.call("GET", "/api/teacher/assignments");
  ok(r.json.assignments.length === 1 && r.json.assignments[0].note === "Hemma", "and the assignment");
  r = await C2.call("POST", "/api/teacher/classes", { name: "Egen" });
  ok(r.status === 201, "a caregiver without a family of their own can make one");

  // messages go to every guide of the class they were written in
  r = await Lo.call("POST", "/api/me/chat", { text: "Hjälp hemma", classId: family.id });
  ok(r.status === 201, "the child asks in the family");
  r = await Lo.call("POST", "/api/me/chat", { text: "Hjälp i skolan", classId: school.id });
  ok(r.status === 201, "and in the school");
  r = await Lo.call("POST", "/api/me/chat", { text: "x", classId: 99999 });
  ok(r.status === 400, "not in a class the child is not in");
  ok((await C.call("GET", "/api/teacher/chat/unread")).json.unread === 1 && (await C2.call("GET", "/api/teacher/chat/unread")).json.unread === 1 && (await T.call("GET", "/api/teacher/chat/unread")).json.unread === 1,
    "one question each for the two parents and for the teacher");
  r = await C2.call("POST", "/api/teacher/chat", { studentId: loId, text: "Vi gör det ihop" });
  ok(r.status === 201, "the second parent answers");
  ok((await C.call("GET", "/api/teacher/chat/unread")).json.unread === 0, "and the first parent no longer has it unread");
  ok((await T.call("GET", "/api/teacher/chat/unread")).json.unread === 1, "the teacher still has the question from school");
  r = await Lo.call("GET", "/api/me/data");
  const answer = r.json.chat.find((m) => m.fromTeacher);
  ok(answer && answer.guide === "Per Multi" && answer.classId === family.id, "the child sees who answered, and in which class");
  r = await T.call("GET", "/api/teacher/students");
  ok(r.json.students[0].chat.length === 1, "the teacher sees only the conversation of the school");

  // the owner can remove a guide, a guide can leave, and the owner cannot
  r = await C2.call("DELETE", "/api/teacher/classes/" + family.id + "/guides/" + (await C.call("GET", "/api/teacher/classes")).json.classes[0].guides[0].id);
  ok(r.status === 400, "the owner cannot be removed");
  const guides = (await C.call("GET", "/api/teacher/classes")).json.classes[0].guides;
  const second = guides.find((g) => !g.owner);
  r = await C.call("DELETE", "/api/teacher/classes/" + family.id + "/guides/" + second.id);
  ok(r.status === 200, "the owner removes the other parent");
  r = await C2.call("GET", "/api/teacher/students");
  ok(r.json.students.length === 0, "who then sees no children");
  r = await C2.call("POST", "/api/teacher/join", { guideCode: family.guideCode });
  ok(r.status === 200, "and joins again with the code");
  r = await C2.call("DELETE", "/api/teacher/classes/" + family.id + "/guides/" + second.id);
  ok(r.status === 200, "a guide can leave");
  r = await T.call("POST", "/api/teacher/join", { guideCode: "VFELFELFEL" });
  ok(r.status === 400, "a wrong code is refused");

  // a child only in the family goes with it, a child in two classes keeps the account
  r = await C.call("POST", "/api/teacher/students", { classId: family.id, username: "multiMo", displayName: "Mo Multi", password: "hemligt-123" });
  const moId = r.json.student.id;
  r = await C.call("DELETE", "/api/teacher/students/" + moId);
  ok(r.status === 200, "the caregiver removes a child who is only in the family");
  r = await Mo.call("POST", "/api/login", { username: "multiMo", password: "hemligt-123" });
  ok(r.status === 401, "and the account is gone");
  r = await C.call("DELETE", "/api/teacher/classes/" + family.id);
  ok(r.status === 200, "the owner deletes the family");
  r = await Lo.call("GET", "/api/me");
  ok(r.status === 200 && r.json.user.classes.length === 1 && r.json.user.className === "4B" && r.json.user.guide === "teacher", "Lo still has the account, in the school class");
  r = await Lo.call("GET", "/api/me/data");
  ok(r.json.feedback.length === 1 && r.json.feedback[0].text === "Bra i skolan" && r.json.assignments.length === 1, "and what came from the school, and none of what came from home");
  r = await T.call("DELETE", "/api/teacher/classes/" + school.id);
  ok(r.status === 200, "the teacher deletes the school class");
  r = await Lo.call("POST", "/api/login", { username: "multiLo", password: "hemligt-123" });
  ok(r.status === 401, "and when that is deleted too, the account goes with it, as before");

};
