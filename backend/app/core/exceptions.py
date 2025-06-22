from fastapi import HTTPException, status

class AppException(HTTPException):
    """Base class for application-specific exceptions."""
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class DatabaseError(AppException):
    """Exception for database related errors."""
    def __init__(self, detail: str = "A database error occurred."):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)

class OpenAIError(AppException):
    """Exception for OpenAI API related errors."""
    def __init__(self, detail: str = "An error occurred while communicating with the OpenAI API."):
        # Could be 500, 502, 503, 504 depending on the OpenAI error type
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

class RateLimitError(AppException):
    """Exception for rate limiting errors (e.g., OpenAI)."""
    def __init__(self, detail: str = "Rate limit exceeded. Please try again later."):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)

class InvalidInputError(AppException):
    """Exception for invalid user input not caught by standard validation."""
    def __init__(self, detail: str = "Invalid input provided."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class NotFoundError(AppException):
    """Exception for when a resource is not found."""
    def __init__(self, resource: str = "Resource"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found.")

class AuthenticationError(AppException):
    """Exception for authentication failures."""
    def __init__(self, detail: str = "Authentication failed."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}, # Standard for 401
        )

class AuthorizationError(AppException):
    """Exception for authorization failures (user authenticated but lacks permission)."""
    def __init__(self, detail: str = "You do not have permission to perform this action."):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

class ConfigurationError(AppException):
     """Exception for configuration-related issues."""
     def __init__(self, detail: str = "Server configuration error."):
         super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)

# You can add more specific exceptions as needed.