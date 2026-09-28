import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsOptional() @IsBoolean() rememberMe?: boolean;
}
export class ForgotPasswordDto { @IsEmail() email!: string; }
export class ResetPasswordDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; @IsString() @MinLength(12) @MaxLength(128) password!: string; }
export class VerifyEmailDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; }
