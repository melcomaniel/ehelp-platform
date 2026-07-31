import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  CreateStaffAccountDto,
  DevLoginDto,
  FirstTimeEverifyDto,
  LivenessBindEverifyDto,
  LivenessCreateDto,
  LivenessVerifyDto,
  LoginCompleteDto,
  LoginLivenessSessionDto,
  SsoExchangeDto,
} from './dto/auth.dto';
import type { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Partner SSO callback landing.
   * ?client=web → redirect to web app; otherwise deep-link mobile.
   */
  @Get('egovph/sso')
  ssoCallbackPage(
    @Query('exchange_code') exchangeCode: string,
    @Query('client') client: string,
    @Res() res: Response,
  ) {
    const code = exchangeCode || '';
    const webBase = (
      process.env.WEB_APP_URL ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    if ((client || '').toLowerCase() === 'web') {
      const target = `${webBase}/auth/sso?exchange_code=${encodeURIComponent(code)}`;
      return res.redirect(302, target);
    }

    const html = `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
      <h1>eGov SSO</h1>
      <p>exchange_code received. Opening mobile app…</p>
      <script>
        var code = ${JSON.stringify(code)};
        if (code) {
          window.location = 'ehelp://egovph/sso?exchange_code=' + encodeURIComponent(code);
        }
      </script>
      <p>If the app does not open, copy this code into the app: <code>${code}</code></p>
      <p><a href="${webBase}/auth/sso?exchange_code=${encodeURIComponent(code)}">Continue on web portal</a></p>
    </body></html>`;
    res.type('html').send(html);
  }

  @Post('sso/exchange')
  ssoExchange(@Body() body: SsoExchangeDto, @Req() req: Request) {
    const platform = this.clientPlatform(req, body.client_platform);
    return this.auth.ssoExchange(
      body.exchange_code,
      platform,
      body.device_fingerprint,
    );
  }

  /** Finish SSO login after face liveness (human check). */
  @Post('login/complete')
  completeLogin(@Body() body: LoginCompleteDto) {
    return this.auth.completeLogin(
      body.pending_login_token,
      body.liveness_session_token,
      body.device_fingerprint,
    );
  }

  @Post('staff')
  @UseGuards(AuthGuard('jwt'))
  createStaff(
    @Body() body: CreateStaffAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.auth.createStaffAccount(req.user.sub, {
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      office_id: body.office_id,
      organization_id: body.organization_id,
      password: body.password,
      phone: body.phone,
    });
  }

  @Get('staff')
  @UseGuards(AuthGuard('jwt'))
  listStaff(@Req() req: Request & { user: JwtPayload }) {
    return this.auth.listStaffAccounts(req.user.sub);
  }

  private clientPlatform(
    req: Request,
    bodyPlatform?: 'mobile' | 'web',
  ): 'mobile' | 'web' {
    const header = String(req.headers['x-client-platform'] ?? '')
      .trim()
      .toLowerCase();
    if (header === 'web' || header === 'mobile') return header;
    if (bodyPlatform === 'web' || bodyPlatform === 'mobile')
      return bodyPlatform;
    return 'mobile';
  }

  private publicBaseFromReq(req: Request): string | undefined {
    const configured = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    if (configured) return configured;
    const host = req.get('host');
    if (!host) return undefined;
    // Prefer the Host the phone actually used (LAN IP on physical devices).
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    return `${proto}://${host}`;
  }

  @Post('liveness/session')
  @UseGuards(AuthGuard('jwt'))
  createLiveness(
    @Body() body: LivenessCreateDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.auth.createLivenessSession({
      purpose: body.purpose,
      userId: body.user_id ?? req.user.sub,
      callbackUrl: body.callback_url,
      action: body.action,
      publicBaseUrl: this.publicBaseFromReq(req),
    });
  }

  /** Login flow: create liveness from pending SSO token (no full session yet). */
  @Post('liveness/session/login')
  createLoginLiveness(
    @Body() body: LoginLivenessSessionDto,
    @Req() req: Request,
  ) {
    return this.auth.createLoginLivenessSession({
      pendingLoginToken: body.pending_login_token,
      callbackUrl: body.callback_url,
      action: body.action,
      publicBaseUrl: this.publicBaseFromReq(req),
    });
  }

  /** Allow unauthenticated session create during first-time onboarding after SSO */
  @Post('liveness/session/public')
  createLivenessPublic(@Body() body: LivenessCreateDto, @Req() req: Request) {
    return this.auth.createLivenessSession({
      purpose: body.purpose,
      userId: body.user_id,
      callbackUrl: body.callback_url,
      action: body.action,
      publicBaseUrl: this.publicBaseFromReq(req),
    });
  }

  @Post('liveness/verify')
  @UseGuards(AuthGuard('jwt'))
  verifyLiveness(
    @Body() body: LivenessVerifyDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.auth.verifyLiveness(body.session_token, req.user.sub);
  }

  @Post('everify/first-time')
  @UseGuards(AuthGuard('jwt'))
  firstTime(
    @Body() body: FirstTimeEverifyDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.auth.firstTimeEverify(req.user.sub, body);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: Request & { user: JwtPayload }) {
    return this.auth.me(req.user.sub, this.clientPlatform(req));
  }

  @Post('dev/login')
  devLogin(@Body() body: DevLoginDto, @Req() req: Request) {
    return this.auth.devLogin(
      body.email,
      body.password,
      this.clientPlatform(req, body.client_platform),
      body.device_fingerprint,
    );
  }

  @Get('provider-mode')
  providerMode() {
    const mode =
      (process.env.AUTH_PROVIDER_MODE ?? 'mock').trim().toLowerCase() === 'live'
        ? 'live'
        : 'mock';
    return {
      mode,
      note:
        mode === 'live'
          ? 'Live eGov SSO, Face Liveness, and NationalID eVerify'
          : 'Mock adapters — no real camera or PhilSys check; flows auto-succeed for local MVP',
    };
  }

  @Get('liveness/mock-ui')
  mockLivenessUi(
    @Query('token') token: string,
    @Query('callback') callback: string,
    @Query('delay') delay: string,
    @Res() res: Response,
  ) {
    const ms = Number(delay || 800);
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Mock Face Liveness</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;max-width:420px;margin:0 auto;text-align:center;background:#fff8e6;color:#412402}
        .badge{display:inline-block;background:#c2410c;color:#fff;font-weight:700;padding:6px 12px;border-radius:999px;font-size:12px;letter-spacing:.04em}
        h2{margin:16px 0 8px}
        p{line-height:1.45;color:#5c4030}
        button{margin-top:20px;width:100%;padding:14px 16px;font-size:16px;font-weight:600;border:0;border-radius:12px;background:#0040E7;color:#fff}
        .muted{font-size:13px;color:#7a5c45;margin-top:16px}
      </style></head><body>
      <span class="badge">MOCK · NO CAMERA</span>
      <h2>Simulated Face Liveness</h2>
      <p>This is <strong>not</strong> a real face scan. With <code>AUTH_PROVIDER_MODE=mock</code> the API always returns a passing result so you can develop offline.</p>
      <p>Real camera + scoring only runs when the backend is set to <strong>live</strong> and Face Liveness credentials are configured.</p>
      <button type="button" id="pass">Simulate pass (≥95)</button>
      <p class="muted">Or wait — auto-continues in a few seconds…</p>
      <script>
        function go(){
          var cb = ${JSON.stringify(callback || 'ehelp://liveness-callback')};
          var t = ${JSON.stringify(token || '')};
          window.location = cb + (cb.indexOf('?')>=0?'&':'?') + 'token=' + encodeURIComponent(t) + '&status=SUCCEEDED';
        }
        document.getElementById('pass').onclick = go;
        setTimeout(go, ${Math.max(ms, 2500)});
      </script>
    </body></html>`;
    res.type('html').send(html);
  }

  /**
   * Official eVerify Face Liveness Web SDK page (docs integration).
   * Uses window.eKYC().start({ pubKey, host }) then binds session_id for PhilSys /api/query.
   *
   * The min SDK only accepts postMessage from production origin; we also listen for the
   * hackathon host origin so completion works.
   */
  @Get('liveness/everify-ui')
  everifyLivenessUi(
    @Query('correlation') correlation: string,
    @Query('callback') callback: string,
    @Res() res: Response,
  ) {
    const pubKey = process.env.EVERIFY_PUBKEY || '';
    const host = (
      process.env.EVERIFY_LIVENESS_HOST ||
      'https://hackathon-everify-face-liveness.e.gov.ph'
    ).replace(/\/$/, '');
    const html = `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>eVerify Face Liveness</title>
      <script src="${host}/js/everify-liveness-sdk.min.js"></script>
      <style>
        body{font-family:system-ui,sans-serif;margin:0;padding:24px;max-width:480px;margin-inline:auto;background:#f8fafc;color:#0f172a}
        h1{font-size:1.25rem;margin:0 0 8px}
        .muted{color:#64748b;font-size:14px;line-height:1.45}
        .err{color:#b91c1c;margin-top:12px;white-space:pre-wrap}
        .ok{color:#166534;margin-top:12px}
        button{margin-top:20px;width:100%;padding:14px 16px;font-size:16px;font-weight:600;border:0;border-radius:12px;background:#0040E7;color:#fff}
        button:disabled{opacity:.6}
        pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow:auto;font-size:12px;max-height:180px}
      </style>
    </head><body>
      <h1>Face Liveness</h1>
      <p class="muted">Tap the button, allow camera, and complete the check. This uses the official eVerify Web SDK so National ID verify receives a valid <code>session_id</code>.</p>
      <button type="button" id="startBtn">Start face verification</button>
      <p id="status" class="muted"></p>
      <p id="err" class="err"></p>
      <p id="ok" class="ok"></p>
      <pre id="output" style="display:none"></pre>
      <script>
        var correlation = ${JSON.stringify(correlation || '')};
        var callback = ${JSON.stringify(callback || 'ehelp://liveness-callback')};
        var pubKey = ${JSON.stringify(pubKey)};
        var host = ${JSON.stringify(host)};
        var startBtn = document.getElementById('startBtn');
        var statusEl = document.getElementById('status');
        var errEl = document.getElementById('err');
        var okEl = document.getElementById('ok');
        var output = document.getElementById('output');
        var handled = false;

        function showErr(msg) {
          errEl.textContent = msg || '';
          startBtn.disabled = false;
          startBtn.textContent = 'Retry face verification';
        }

        function finish(sessionId, photoUrl, raw) {
          if (handled) return;
          handled = true;
          statusEl.textContent = 'Saving session for National ID eVerify…';
          if (raw) {
            output.style.display = 'block';
            output.textContent = JSON.stringify(raw, null, 2);
          }
          fetch('/auth/liveness/everify-bind', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              correlation: correlation,
              everify_session_id: sessionId,
              reference_image_url: photoUrl || undefined
            })
          }).then(function(r){
            return r.json().then(function(j){ return { ok: r.ok, j: j }; });
          }).then(function(res){
            if (!res.ok) throw new Error((res.j && (res.j.message || res.j.error)) || 'Bind failed');
            okEl.textContent = 'Done. Return to the app and tap Verify, then National ID eVerify.';
            statusEl.textContent = '';
            var sep = callback.indexOf('?') >= 0 ? '&' : '?';
            setTimeout(function(){
              window.location = callback + sep
                + 'token=' + encodeURIComponent(correlation)
                + '&everify_session_id=' + encodeURIComponent(sessionId)
                + '&status=SUCCEEDED';
            }, 500);
          }).catch(function(e){
            handled = false;
            showErr(String(e.message || e));
          });
        }

        // Official SDK only accepts production origin; hackathon iframe posts from host.
        function onMsg(ev) {
          if (ev.origin !== host && ev.origin !== 'https://liveness.everify.gov.ph') return;
          var payload = ev.data;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch (e) { return; }
          }
          if (!payload || typeof payload !== 'object') return;
          if (payload.error) {
            showErr(payload.message || JSON.stringify(payload));
            return;
          }
          var sessionId = payload.session_id || (payload.result && payload.result.session_id);
          var photoUrl = payload.photo_url || (payload.result && payload.result.photo_url);
          if (sessionId) finish(sessionId, photoUrl, payload);
        }
        window.addEventListener('message', onMsg);

        function startVerification() {
          handled = false;
          errEl.textContent = '';
          okEl.textContent = '';
          output.style.display = 'none';
          if (!pubKey) { showErr('EVERIFY_PUBKEY missing on server'); return; }
          if (!window.eKYC) { showErr('eVerify SDK failed to load from ' + host); return; }
          startBtn.disabled = true;
          startBtn.textContent = 'Camera check in progress…';
          statusEl.textContent = 'Follow the on-screen face check. Do not leave this page.';

          window.eKYC().start({
            pubKey: pubKey,
            host: host
          }).then(function(response) {
            output.style.display = 'block';
            output.textContent = JSON.stringify(response, null, 2);
            if (response && response.status === 'COMPLETED' && response.result && response.result.session_id) {
              finish(response.result.session_id, response.result.photo_url, response);
            } else if (!handled) {
              showErr('Liveness did not complete: ' + JSON.stringify(response));
            }
          }).catch(function(error) {
            if (handled) return;
            showErr(typeof error === 'string' ? error : JSON.stringify(error, null, 2));
          });
        }

        startBtn.addEventListener('click', startVerification);
      </script>
    </body></html>`;
    res.type('html').send(html);
  }

  @Post('liveness/everify-bind')
  bindEverify(@Body() body: LivenessBindEverifyDto) {
    return this.auth.bindEverifyLiveness({
      correlation: body.correlation,
      everifySessionId: body.everify_session_id,
      referenceImageUrl: body.reference_image_url,
    });
  }
}
