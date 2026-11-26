// =========================================
// RELAY PROTOTYPE - HOUSEHOLD DATABASE
// =========================================

const households = {
  "HH-SM-0205": {
    id: "HH-SM-0205",
    head: "Santos",
    barangay: "San Miguel",
    purok: "Purok 3, Barangay San Miguel",
    address: "14 Riverside Street, Purok 3",
    tenure: "Owner",
    contact: "0917-555-0205",
    members: [
      { name: "Marco Santos", age: 42, sex: "Male", rel: "Head", category: "None", needs: "None" },
      { name: "Rosa Santos", age: 40, sex: "Female", rel: "Spouse", category: "None", needs: "None" },
      { name: "Elena Santos", age: 68, sex: "Female", rel: "Parent", category: "Senior Citizen", needs: "Mobility assistance" },
      { name: "Leo Santos", age: 12, sex: "Male", rel: "Child", category: "Child", needs: "None" },
      { name: "Noah Santos", age: 8, sex: "Male", rel: "Child", category: "Child", needs: "None" }
    ]
  },
  "HH-SM-0112": {
    id: "HH-SM-0112",
    head: "Reyes",
    barangay: "San Miguel",
    purok: "Purok 2, Barangay San Miguel",
    address: "82 Mango Avenue, Purok 2",
    tenure: "Renter",
    contact: "0918-555-0112",
    members: [
      { name: "Jose Reyes", age: 36, sex: "Male", rel: "Head", category: "None", needs: "None" },
      { name: "Ana Reyes", age: 34, sex: "Female", rel: "Spouse", category: "Pregnant", needs: "Priority transport" },
      { name: "Mia Reyes", age: 4, sex: "Female", rel: "Child", category: "Child", needs: "None" },
      { name: "Carlo Reyes", age: 71, sex: "Male", rel: "Parent", category: "Senior Citizen", needs: "Maintenance medicine" }
    ]
  },
  "HH-SM-0308": {
    id: "HH-SM-0308",
    head: "Dela Cruz",
    barangay: "San Miguel",
    purok: "Purok 1, Barangay San Miguel",
    address: "45 Creekside Road, Purok 1",
    tenure: "Owner",
    contact: "0919-555-0308",
    members: [
      { name: "Juan Dela Cruz", age: 50, sex: "Male", rel: "Head", category: "Chronic Illness", needs: "Maintenance medicine" },
      { name: "Maricel Dela Cruz", age: 47, sex: "Female", rel: "Spouse", category: "None", needs: "None" },
      { name: "Paolo Dela Cruz", age: 21, sex: "Male", rel: "Child", category: "PWD", needs: "Mobility assistance" },
      { name: "Chloe Dela Cruz", age: 16, sex: "Female", rel: "Child", category: "None", needs: "None" },
      { name: "Lola Nena Dela Cruz", age: 76, sex: "Female", rel: "Grandparent", category: "Senior Citizen", needs: "Mobility assistance" },
      { name: "Tito Ben Dela Cruz", age: 55, sex: "Male", rel: "Relative", category: "None", needs: "None" }
    ]
  },
  "HH-TB-0104": {
    id: "HH-TB-0104",
    head: "Mendoza",
    barangay: "Tibanga",
    purok: "Purok 2, Barangay Tibanga",
    address: "19 Tibanga Boulevard, Purok 2",
    tenure: "Owner",
    contact: "0927-555-0104",
    members: [
      { name: "Roberto Mendoza", age: 45, sex: "Male", rel: "Head", category: "None", needs: "None" },
      { name: "Carla Mendoza", age: 43, sex: "Female", rel: "Spouse", category: "None", needs: "None" },
      { name: "Lydia Mendoza", age: 66, sex: "Female", rel: "Parent", category: "Senior Citizen", needs: "Maintenance medicine" },
      { name: "Sam Mendoza", age: 9, sex: "Male", rel: "Child", category: "Child", needs: "None" }
    ]
  },
  "HH-TB-0219": {
    id: "HH-TB-0219",
    head: "Odicta",
    barangay: "Tibanga",
    purok: "Purok 1, Barangay Tibanga",
    address: "63 Harbor View Street, Purok 1",
    tenure: "Sharer",
    contact: "0928-555-0219",
    members: [
      { name: "Teody Odicta", age: 53, sex: "Male", rel: "Head", category: "Chronic Illness", needs: "Life-support equipment" },
      { name: "Grace Odicta", age: 49, sex: "Female", rel: "Spouse", category: "None", needs: "None" },
      { name: "Dan Odicta", age: 24, sex: "Male", rel: "Child", category: "None", needs: "None" }
    ]
  },
  "HH-SR-0107": {
    id: "HH-SR-0107",
    head: "Lim",
    barangay: "Saray",
    purok: "Purok 4, Barangay Saray",
    address: "27 Saray Riverbank, Purok 4",
    tenure: "Owner",
    contact: "0935-555-0107",
    members: [
      { name: "Kevin Lim", age: 39, sex: "Male", rel: "Head", category: "None", needs: "None" },
      { name: "joyce Lim", age: 37, sex: "Female", rel: "Spouse", category: "None", needs: "None" },
      { name: "Aiden Lim", age: 6, sex: "Male", rel: "Child", category: "Child", needs: "None" }
    ]
  },
  "HH-SR-0315": {
    id: "HH-SR-0315",
    head: "Ramos",
    barangay: "Saray",
    purok: "Purok 5, Barangay Saray",
    address: "102 National Highway, Purok 5",
    tenure: "Renter",
    contact: "0936-555-0315",
    members: [
      { name: "Eric Ramos", age: 48, sex: "Male", rel: "Head", category: "PWD", needs: "Mobility assistance" },
      { name: "Rowena Ramos", age: 44, sex: "Female", rel: "Spouse", category: "None", needs: "None" },
      { name: "Mika Ramos", age: 14, sex: "Female", rel: "Child", category: "None", needs: "None" },
      { name: "Lolo Pedro Ramos", age: 74, sex: "Male", rel: "Parent", category: "Senior Citizen", needs: "Mobility assistance" },
      { name: "Nina Ramos", age: 10, sex: "Female", rel: "Child", category: "Child", needs: "None" }
    ]
  }
};
