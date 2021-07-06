const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = mongoose.Schema({
    fullname: {
        type: String
    },
    usertype: {
        type: String
    },
    username: {
        type: String,
        required: true,
    },
    courses: {
        type: [String],
        default: []

    }
});

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);
module.exports = User;