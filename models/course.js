const mongoose = require("mongoose");

const CourseSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: true,
    },
    author: {
        type: String
    },
    author_id: {
        type: String
    },
    students: {
        type: [String],
        default: []
    }
});

const Course = mongoose.model("Course", CourseSchema);
module.exports = Course;