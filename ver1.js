//requiring various packages for the app
const express=require('express');
const app=express();
const fs=require('fs');//for file system queries
const multer=require('multer');//for multipart/form-data 
const body_parser=require('body-parser');//to get the body of the http request
const mongoose=require('mongoose');//for database
const movie=require('moviedb')('443ebcf03194b9bd03065942757c79af');//movie db package followed by api key
const session=require('express-session');//session


app.use(session({secret: 'ssshhhhh',saveUninitialized: true,resave: true}));//setting up session will be starting in the login route

app.set('view engine','ejs');//setting the view engine for files as ejs

var port=process.env.PORT||80;// setting the default port 

app.use('/',express.static(__dirname+'/views'));//setting root directory

//setting storage for the multer 
var storage=multer.diskStorage({
	destination:function(req,file,cb){
		cb(null,'uploads')
	},
	filename:function(req,file,cb){
		cb(null,file.fieldname + '-' + Date.now())
	}
})

var upload=multer({storage:storage});

var urlencodedParser = body_parser.urlencoded({ extended: false });//body parser object


//connecting to mongoDB
mongoose.connect('mongodb://http://ec2-18-218-11-92.us-east-2.compute.amazonaws.com:27017/db', {useNewUrlParser: true},function(err){
	if (err) throw err;
	console.log('successfully connected');
});

//defining schema for the collections
var userSchema=mongoose.Schema({
	name:String,
	email:String,
	password:String //,
	// image:{
	//  	data:Buffer,contentType:String
	// }
})


var likes=mongoose.Schema({
	username:String,
	movie_name:String
})

var images=mongoose.Schema({
	name:String,
	image:{
		data:Buffer,contentType:String
	}
})

var sess;//session variable

//creating valuable routes
app.get('/',function(req,res){
	res.render('home_page');
})

app.get('/signup',function(req,res){
	sess=req.session;
	if(sess.name)
	{
		return res.redirect('/search');
	}
	else{
		res.render('signup');
	}
	
})


//defining collection
var users=mongoose.model('users',userSchema);

var likes=mongoose.model('likes',likes);

var images=mongoose.model('images',images);


//to find already regitered user
//storing binary data(image) in the database from the middleware using multer
app.post('/data',urlencodedParser,function(req,res)
{
	name=req.body.username;
	password=req.body.password;
	email=req.body.email;
	// // console.log(fs.readFileSync(req.file.path));
	// image=req.body.pic;
	// //image=fs.readFileSync(req.file.path);
	// encode_image =image.toString('base64');
	// //console.log(Buffer.from(image).toString('Base64'));
	// // Define a JSONobject for the image attributes for saving to database
	// finalImg = {
	// 	 data:new Buffer(encode_image, 'base64'),
	// 	 contentType: 'image/jpg'
	// };

	users.find({name:name}).exec(function(err,entry){
		if (err) throw err;
		if(entry.length>0)
		{
			res.write('<h1>This username is taken.....signup with a new one</h1>');
        	res.end('<a href='+'/signup'+'>signup</a>');	
		}
		else{
			var user=users({
				name:name,
				password:password,
				email:email//,
		//		image:finalImg
			});
			user.save(function(err)
			{
				if (err) throw err;
				console.log('entry saved successfully check out the database');
			})
			return res.redirect('/');
		}
	})

})



app.post('/profile_data',upload.single('picture'),function(req,res){
	sess=req.session;
	// console.log(sess.name);
	name=sess.name;
	img = fs.readFileSync(req.file.path);
	encode_image = img.toString('base64');
	// console.log(img);
	// console.log(encode_image);
	// Define a JSONobject for the image attributes for saving to database
	finalImg = {
		 data:  new Buffer(encode_image, 'base64'),
		 contentType: req.file.mimetype
	};
	images.find({name:name}).exec(function(err,img){
		if (err) throw err;
		if(img.length)
		{
			images.findOneAndUpdate({name:name}, {$set: {image:finalImg}}, function (err, doc) {
			if (err) {
				console.log("update document error");
			} else {
				console.log("update document success");
				console.log(doc);
			}

});
		}
		else{
			var image=images({
				name:name,
				image:finalImg
			});
			image.save(function(err)
			{
				if (err) throw err;
				console.log('entry saved successfully check out the database');
			})
		}
	})
	return res.redirect('/search');
})



//user authentication
app.post('/signin_success',urlencodedParser,function(req,res){
	username=req.body.username;
	password=req.body.password;
	var flag=0;
	sess=req.session;
	users.find().exec(function(err,u){
	 	if (err) throw err;
		for(i=0;i<u.length;i++)
		{
			if(u[i].name==username && u[i].password==password)
			{
				sess.name=u[i].name;
				flag=1;
				return res.redirect('/search');
			}
		}
		if(flag==0)
		{
			return res.redirect('/');
		}
	 })

	
})

//kind of middle ware route just to render the image
app.get('/profile_img',function(req,res){
	sess=req.session;
	if(sess.name){
		images.find({name:sess.name}).exec(function(err,images){
			if (err) throw err;
			//console.log(users[0].image);
			res.contentType('image/jpg');
			res.send(images[0].image.data);
		})
	}
})

//search form
var pic;
app.get('/search',function(req,res){
	sess=req.session;
	if(sess.name)
	{
		// users.find({name:sess.name}).exec(function(err,users){
		// 	if (err) throw err;
		// 	console.log(users);
		// 	// res.render('search',{name:sess.name,image:pic[0].image});
		// })
		res.render('search',{name:sess.name});
	}
	else{
		res.write('<h1>Please login first.</h1>');
        res.end('<a href='+'/'+'>login</a>');
	}
	
})

//image uploading page
app.get('/search/image_upload',function(req,res){
	sess=req.session;
	if(sess.name)
	{
		res.render('image_upload');
	}
	else{
		res.write('<h1>Please login first.</h1>');
		res.end('<a href='+'/'+'>login</a>');
	}
})



var b;//for the dynamic like mechanism
//fetching the results from the api
app.post('/search_results',urlencodedParser,function(req,res){
	sess=req.session;
	if(sess.name)
	{
		likes.find({username:sess.name}).exec(function(err,likes){
			if (err) throw err;
			b=likes;
		})
		movie.searchMovie({query:req.body.movie_name}, (err, r) => {
			len=b.length;
			a=[];
			for(i=0;i<r["results"].length;i++)
			{
				a[i]=r["results"][i];
			}
			length=a.length;
			res.render('details',{array:a,l:length,url:"https://image.tmdb.org/t/p/w600_and_h900_bestv2",like:b,len:len});//sending like array and its length for the button to check in
		});
	}
	else{
		res.write('<h1>Please login first.</h1>');
        res.end('<a href='+'/'+'>login</a>');
	}
})


//like button response storage in database
app.post('/like',urlencodedParser,function(req,res){
	sess=req.session;
	likes.find({username:sess.name,movie_name:req.body.data}).exec(function(err,like){
		if (err) throw err;
		if(like.length)
		{
			likes.deleteOne({username:sess.name,movie_name:req.body.data}, function (err, result) {
				if (err) {
		
					console.log("error query");
		
				} else {
		
					console.log(result);
		
				}
		
			});
			
		}
		else{
			var like=likes({
				 		username:sess.name,
				 		movie_name:req.body.data
				 	});
				 	like.save(function(err)
				 	{
				 		if (err) throw err;
				 		console.log('entry saved successfully check out the database');
				    })
		}
	})
		
})


//user profile
app.get('/profile',function(req,res){
	sess=req.session;
	if(sess.name)
	{
		likes.find({username:sess.name}).exec(function(err,likes){
			if (err) throw err;
			l=likes.length;
			res.render('fetch',{data:likes,length:l});
		})
	}
	else{
		return res.redirect('/');
	}
})


//searching other user's profile
app.post('/search_profile',urlencodedParser,function(req,res){
	console.log(req.body.profile);
	sess=req.session;
	if(sess.name)
	{
		likes.find({username:req.body.profile}).exec(function(err,likes){
			if (err) throw err;
			l=likes.length;
			if(l>0)
				res.render('fetch',{data:likes,length:l});
			else{
				res.send('he has no likes till now');
			}
			
		})	
	}
	else{
		return res.redirect('/');
	}
})

//logout
app.get('/logout',function(req,res){
	sess=req.session;
		req.session.destroy((err) => {
			if(err) {
				return console.log(err);
			}
			res.redirect('/');
		});
})

app.listen(port,()=> console.log('Server running on port'));
