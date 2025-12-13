const asyncHandler = (requestHandler) => {
  (req, res, next) => {
    Promise.resolve(requestHandler(req, res , next)).catch((err) => next(err))
  }
}

export {asyncHandler}

/*
const asyncHandler = () => {}   //this is a basic function
const asyncHandler = (func) => {} //passed another function as parater
const asyncHandler = (func) => {() => {}} //this is a highorder function that passed another function as parameter and can also return it.
const asyncHandler = (func) => {async () => {}} //make call back function to async function 
*/
/*
const asyncHandler = (fn) => async (req , res , next) => {
  try{
    await fn(req, res, next)
  }
  catch(error){
    res.status(error.code || 500).json({   //here error display as res or error code will be show till now happen because of res.status. Now json also send some response : success - that tell it excute successfully then 'true' or if not then 'false'
      success: false,
      message: error.message
    })
  }
}
  */