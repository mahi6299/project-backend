import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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

  if (!(username || email)) {
    throw new ApiError(400, "username or password is required");
  }
  // here is an alternative of above code based on logic discuss
  /*if (!username && !email) {
    throw new ApiError(400, "username or password is required");
  } */

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

/*
when accessToken get expired after 24hrs then the user will get a 401 request that your access has expired,
so what can the person at the frontend do,  if he is trying to access a resource and gets a 401 request then instead of telling the user to login again, what can he do? he can write a small code that :-
if a 401 request comes, then hit an endpoint and get your access token refreshed from there, that  means, a new token will be otained.
Now, how will you get a new token?
you will send your refresh token in that request along with it, now as soon as I get the refresh token, what I will do in backend?
Because it's stored inside my database, I'll match the refresh token to see if what you sent and what I have in the backend are the same. If it is , then let's start the session again. 
So, I'll send a new access token in cookies and also a new refresh token. So, I'll refresh that as well save it 
*/
// thus, that endpoint going to be create here for user

const refreshAccessToken = asyncHandler(async (req, res) => {
  //refresh token of user
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request");
    }

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(404, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id); //get user id
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Incorrect Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(401, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(new ApiResponse(200));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(401, "Cover image is not upload on cloudinary properly");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
