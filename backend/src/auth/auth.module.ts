import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeneficiaryEntity } from '../users/beneficiary.entity';
import { LivenessSessionEntity } from '../users/liveness-session.entity';
import { StaffProfileEntity } from '../users/staff-profile.entity';
import {
  RoleEntity,
  UserAccountEntity,
  UserRoleAssignmentEntity,
} from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import {
  LiveEgovSsoProvider,
  LiveEverifyProvider,
  LiveLivenessProvider,
} from './providers/live.providers';
import {
  MockEgovSsoProvider,
  MockEverifyProvider,
  MockLivenessProvider,
} from './providers/mock.providers';
import {
  EGOV_SSO_PROVIDER,
  EVERIFY_PROVIDER,
  LIVENESS_PROVIDER,
} from './providers/tokens';

const useLive = process.env.AUTH_PROVIDER_MODE === 'live';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'ehelp-dev-jwt-secret',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as `${number}d`,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      UserAccountEntity,
      BeneficiaryEntity,
      StaffProfileEntity,
      RoleEntity,
      UserRoleAssignmentEntity,
      LivenessSessionEntity,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: EGOV_SSO_PROVIDER,
      useClass: useLive ? LiveEgovSsoProvider : MockEgovSsoProvider,
    },
    {
      provide: EVERIFY_PROVIDER,
      useClass: useLive ? LiveEverifyProvider : MockEverifyProvider,
    },
    {
      provide: LIVENESS_PROVIDER,
      useClass: useLive ? LiveLivenessProvider : MockLivenessProvider,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
