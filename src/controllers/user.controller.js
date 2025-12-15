import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {

  //get user details from frontend
  const {fullName , email, username , password} = req.body
  console.log("email: ", email);

  // validation 
  // approach 1
  /*
  if(fullName === "") {
    throw new ApiError(400 , "fullname is required")
  }
    */

  // approach 2:
  if(
    [fullName , email, username, password].some(
      (field) => field?.trim() === ""
    )
  ){
    throw new ApiError(400, "All fields are required")
  }

  const existedUser = User.findOne({
    $or: [{username} , {email}]
  })

  if(existedUser){
    throw new ApiError(409, "User with email or username already exists")
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required")
  }

  // uploading image on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!avatar){
    throw new ApiError(400, "Avatar file is required")
  }

  // create user object 
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "", //this is done only in coverImage because , it is possible that user does not give cover Image
    email,
    password,
    username: username.tolowerCase()
  })

  // remove password and refreshToken 
  const userExists = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  // check for user creation successfully
  if(!userExists){
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  // return response or result
  return res.status(201).json(
    new ApiResponse(200, userExists, "User registered successfully")
  )
});

export { registerUser };
