import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // putting refreshToken inside database
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false }); //saving refresh token inside db

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //1. get user details from frontend
  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  //2. validation
  // approach 1
  /*
  if(fullName === "") {
    throw new ApiError(400 , "fullname is required")
  }
    */

  // approach 2:
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. check user already exist with username or email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // 4. check for images and avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  // here we checked for avatar
  if (!avatarLocalPath) {
    throw new ApiError(401, "Avatar file is required");
  }

  // to check for coverImage we use classic method
  let coverImageLocalPath;
  if (
    re.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  //5. uploading image on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(402, "Avatar file is required");
  }

  //6. create user object
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "", //this is done only in coverImage because , it is possible that user does not give cover Image
    email,
    password,
    username: username.tolowerCase,
  });

  //7. remove password and refreshToken
  const userExists = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //8. check for user creation successfully
  if (!userExists) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //9. return response or result
  return res
    .status(201)
    .json(new ApiResponse(200, userExists, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  // there is a code which work on both mode or any mode whether it is username based or email based
  // find user
  // password check
  // access and refresh token
  // send cookie
  // return response

  // req body -> data
  const { email, username, password } = req.body;

  if (!username || !email) {
    throw new ApiError(400, "username or password is required");
  }

  // check given data of username or email is exists in db or not exist in db
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // password check
  /*
  // User: it is object of mongoose of mongoDB
  then through mongoose, you have all the methods you need or available such as findOne , updateOne these are available through mongoDB

  but this method that you have created, such as correct password , generate token etc , they are avialable on your user

  */

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // give the access to the user whose id given by user._id, here you get access of accessToken and refresh tokwn
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // .select is used to choose such field which we don't want
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  ); //now logged In user have all fields except these two

  //now sending some cookies you have to design some optins that options are object
  // by default cookie can be modified by anyone in frontend
  // but when using options it get access by only server.

  const options = {
    httpOnly: true,
    secure: true,
  }; //here now cookie can only ne modified from the server and cannot be modified from the frontend

  return (
    res
      .status(200)
      // because of cookie-parser we can use cookie here
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200, //this is statuscode
          {
            user: loggedInUser,
            accessToken,
            refreshToken,

            /*
        note: we already set access token and refresh tokewn in cookie but again we pass access token and refresh token by user . 
        Reason: here we will take up that case handling when it could be the user hinself taking the access and refresh token from your side wanting to save, but it could be want to save in local storage. or may be he devlops mobile application where cookie will not be set there
        */
          }, //this is data
          "User logged In successfully" //this is message
        )
        //this ApiResponse taken from the file ApiResponse.js inside we define statuscode , then data then message and then if success it show status code that's it
      )
  );
});

// for logout we are using middleware concept where we design own middleware that logout current user
const logoutUser = asyncHandler(async (req, res) => {
  //find user
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .select(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logged Out"));
});

export { registerUser, loginUser, logoutUser };
