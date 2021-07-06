require( "dotenv" ).config();
const express = require( "express" );
const app = express();
const mongoose = require( "mongoose" );
const User = require( "./models/user" );
const Course = require( "./models/course" );
const bodyParser = require( "body-parser" );
const path = require( "path" );
const session = require( "express-session" );
const passport = require( "passport" );
const LocalStrategy = require( "passport-local" );
const flash = require( "connect-flash" );

app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( express.static( path.join( __dirname, "public" ) ) );
app.set( "view engine", "ejs" );
// session setting
app.use( session( {
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
} )
);
app.use( flash() );
app.use( ( req, res, next ) => {
    res.locals.success_msg = req.flash( "success_msg" );
    res.locals.err_msg = req.flash( "err_msg" );
    res.locals.error = req.flash( "error" );
    next();
} );
app.use( passport.initialize() );
app.use( passport.session() );
// authenticate user
passport.use( new LocalStrategy( User.authenticate() ) );
passport.serializeUser( User.serializeUser() );
passport.deserializeUser( User.deserializeUser() );

const isLoggedgIn = ( req, res, next ) => {
    if ( !req.isAuthenticated() ) {
        req.session.returnTo = req.originalUrl;
        req.flash( "err_msg", "Please log in first." );
        res.redirect( "/login" );
    } else {
        next();
    };
};

const isStudent = ( req, res, next ) => {
    if ( req.user.usertype == "Student" ) {
        next();
    } else {
        res.status( 403 ).render( "errorViews/403" );
    };
};

const isTeacher = ( req, res, next ) => {
    if ( req.user.usertype == "Teacher" ) {
        next();
    } else {
        res.status( 403 ).render( "errorViews/403" );
    };
};

// connect to mongoDB
mongoose.connect( process.env.MONGODB_URI || "mongodb://localhost:27017/systemDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
} ).then( () => {
    console.log( "Successfully connnecting to mongoDB." );
} ).catch( ( e ) => {
    console.log( e );
} );

app.get( "/", ( req, res ) => {
    res.render( "index" );
} );

app.get( "/login", ( req, res ) => {
    res.render( "login" );
} );

app.post( "/login", passport.authenticate( "local", { failureFlash: true, failureRedirect: "/login" } ), ( req, res ) => {
    if ( req.session.returnTo ) {
        let newRoute = req.session.returnTo;
        req.session.returnTo = "";
        res.redirect( newRoute );
    } else {
        if ( req.user.usertype == "Student" ) {
            res.redirect( "/student/index" );
        } else {
            res.redirect( "/teacher/index" );
        };
    };
} );

app.get( "/student/index", isLoggedgIn, isStudent, async ( req, res, next ) => {
    let { _id } = req.user;
    try {
        let student = await User.findOne( { _id } );
        let courses = await Course.find( { _id: { $in: student.courses } } );
        res.render( "studentViews/index", { user: req.user, courses } );
    } catch ( err ) {
        next( err );
    };
} );

app.get( "/student/find", isLoggedgIn, isStudent, ( req, res ) => {
    res.render( "studentViews/find", { user: req.user, courses: null } );
} );

app.get( "/courses/find", isLoggedgIn, isStudent, async ( req, res, next ) => {
    let { key } = req.query;
    try {
        let courses = await Course.find( { name: key } );
        res.render( "studentViews/find", { user: req.user, courses } );
    } catch ( err ) {
        next( err );
    };
} );

app.get( "/courses/:key", isLoggedgIn, isStudent, async ( req, res, next ) => {
    let { _id } = req.user;
    let { key } = req.params;
    try {
        let student = await User.findOne( { _id } );
        let course = await Course.findOne( { _id: key } );
        student.courses.push( key );
        course.students.push( _id );
        await student.save();
        await course.save();
        res.redirect( "/student/index" );
    } catch ( err ) {
        next( err );
    };
} );

app.get( "/teacher/index", isLoggedgIn, isTeacher, async ( req, res, next ) => {
    let { _id } = req.user;
    try {
        let teacher = await User.findOne( { _id } );
        let courseFound = await Course.find( { _id: { $in: teacher.courses } } );
        res.render( "teacherViews/index", { user: req.user, courses: courseFound } );
    } catch ( err ) {
        next( err );
    };
} );

app.get( "/teacher/create", isLoggedgIn, isTeacher, ( req, res ) => {
    res.render( "teacherViews/create", { user: req.user } );
} );

app.post( "/teacher/create", isLoggedgIn, isTeacher, async ( req, res ) => {
    let { courseName, description, price } = req.body;
    let { _id, fullname } = req.user;
    try {
        let newCourse = new Course( { name: courseName, description, price, author: fullname, author_id: _id } );
        let teacher = await User.findOne( { _id } );
        await newCourse.save();
        teacher.courses.push( newCourse._id );
        await teacher.save();
        res.redirect( "/teacher/index" );
    } catch ( err ) {
        console.log( err );
        req.flash( "err_msg", "Error with creating new course. Please contact with admin." );
        res.redirect( "/teacher/create" );
    };
} );

app.get( "/register", ( req, res ) => {
    res.render( "register" );
} );

app.post( "/register", async ( req, res, next ) => {
    let { fullname, usertype, username, password, password2 } = req.body;
    if ( password !== password2 ) {
        req.flash( "err_msg", "Passwords don't match. Please check." );
        res.redirect( "/register" );
    } else {
        try {
            let foundUser = await User.findOne( { username } );
            if ( foundUser ) {
                req.flash( "err_msg", "Email has been registered. Please check." );
                res.redirect( "/register" );
            } else {
                let newUser = new User( req.body );
                await User.register( newUser, password );
                req.flash( "success_msg", "Account has been taken. You can login now." );
                res.redirect( "/login" );
            };
        } catch ( err ) {
            next( err );
        };
    };
} );

app.get( "/logout", ( req, res ) => {
    req.logOut();
    res.redirect( "/" );
} );

app.get( "/*", ( req, res ) => {
    res.status( 404 ).render( "errorViews/404" );
} );

app.use( ( err, req, res, next ) => {
    console.log( err );
    res.status( 500 ).render( "errorViews/500" );
    next();
} );

app.listen( process.env.PORT || 3000, () => {
    console.log( "Server is now running on port 3000." );
} );