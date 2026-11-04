/*
  Starting data for the app. Days: 0 = Monday ... 6 = Sunday.
  Each entry needs a unique id. Once an id has been loaded on a device it is
  never added again, so anything you edit or delete in the app stays that way.
  New ids added here later will appear on the next visit.
*/
window.SEED = [
  // Classes: BITS Pilani timetable (weekly pattern, from the Student Center screenshot)
  { id: "cs-l2-am",   kind: "class", type: "Lecture",    title: "CS U111 L2",    start: "09:00", end: "09:50", place: "LTC 5105", days: [0, 2] },
  { id: "cs-l2-pm",   kind: "class", type: "Lecture",    title: "CS U111 L2",    start: "15:00", end: "15:50", place: "LTC 5105", days: [1] },
  { id: "cs-p19",     kind: "class", type: "Laboratory", title: "CS U111 P19",   start: "13:00", end: "14:50", place: "NAB 6018", days: [2] },
  { id: "eee-l2",     kind: "class", type: "Lecture",    title: "EEE U111 L2",   start: "11:00", end: "11:50", place: "LTC 5105", days: [0, 2] },
  { id: "eee-p4",     kind: "class", type: "Laboratory", title: "EEE U111 P4",   start: "13:00", end: "14:50", place: "Faculty Division II 2139", days: [0] },
  { id: "eee-t3",     kind: "class", type: "Tutorial",   title: "EEE U111 T3",   start: "14:00", end: "14:50", place: "NAB 6157", days: [1] },
  { id: "math-l2",    kind: "class", type: "Lecture",    title: "MATH U101 L2",  start: "10:00", end: "10:50", place: "LTC 5105", days: [1, 3, 4] },
  { id: "math-t14",   kind: "class", type: "Tutorial",   title: "MATH U101 T14", start: "08:00", end: "08:50", place: "NAB 6157", days: [3] },
  { id: "bits103-l2", kind: "class", type: "Lecture",    title: "BITS U103 L2",  start: "16:00", end: "16:50", place: "LTC 5102", days: [1, 3] },
  { id: "bits103-p5", kind: "class", type: "Laboratory", title: "BITS U103 P5",  start: "15:00", end: "16:50", place: "Workshop 7101", days: [0, 2] },
  { id: "bits104-l2", kind: "class", type: "Lecture",    title: "BITS U104 L2",  start: "11:00", end: "11:50", place: "LTC 5102", days: [4] },
  { id: "bits104-p3", kind: "class", type: "Laboratory", title: "BITS U104 P3",  start: "15:00", end: "16:50", place: "Location TBA", days: [4] },
  { id: "mgts-l2",    kind: "class", type: "Lecture",    title: "MGTS U102 L2",  start: "15:00", end: "15:50", place: "LTC 5102", days: [3] },
  { id: "sw-l1",      kind: "class", type: "Lecture",    title: "SW E102 L1",    start: "17:00", end: "17:50", place: "Location TBA", days: [0, 2, 4] }

  // Aaditya builds their own routine in the app, so none is seeded here.
];
