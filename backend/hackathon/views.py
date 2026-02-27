import json
import re
from datetime import date

from django.db import IntegrityError, transaction
from django.http import HttpRequest, JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from .auth import (
    ExternalAuthError,
    create_signed_otp_challenge,
    create_signed_session,
    is_success_response,
    load_signed_otp_challenge,
    load_signed_session,
    post_form_json,
    require_env,
)
from .models import (
    LegacyEmployeeBankInfo,
    LegacyEmployeeComplianceTracker,
    LegacyEmployeeCtcInfo,
    LegacyEmployeeMaster,
    LegacyEmployeeRegInfo,
)

SYSTEM_NAME = 'isl'
REGISTER_ROLE = 'isl_user'


def _normalize_phone(raw: str) -> str:
    return re.sub(r'\D+', '', (raw or '').strip())


def _get_bearer_token(request: HttpRequest) -> str | None:
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None

    prefix = 'Bearer '
    if not auth_header.startswith(prefix):
        return None

    token = auth_header[len(prefix) :].strip()
    return token or None


def _get_session_payload(request: HttpRequest) -> dict | None:
    token = _get_bearer_token(request)
    if not token:
        return None
    try:
        return load_signed_session(token)
    except ExternalAuthError:
        return None


def _json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


def _external_error_message(result: dict, default: str) -> str:
    return result.get('error') or result.get('message') or default


def _external_success_message(result: dict) -> str | None:
    message = (result.get('message') or result.get('status') or '').strip()
    return message or None


def _post_external_or_error(
    *,
    url_env: str,
    payload: dict[str, str],
    failure_status: int,
    failure_default_message: str,
) -> tuple[dict | None, JsonResponse | None]:
    try:
        url = require_env(url_env)
    except ExternalAuthError as exc:
        return None, JsonResponse({'error': str(exc)}, status=500)

    try:
        result = post_form_json(url=url, payload=payload)
    except ExternalAuthError as exc:
        return None, JsonResponse({'error': str(exc)}, status=502)

    if not is_success_response(result):
        message = _external_error_message(result, failure_default_message)
        return None, JsonResponse({'error': message}, status=failure_status)

    return result, None



class HealthView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        return JsonResponse({'status': 'ok'})


@method_decorator(csrf_exempt, name='dispatch')
class ApiLoginView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        username_raw = (payload.get('username') or '').strip()
        password = (payload.get('password') or '').strip()

        if not username_raw or not password:
            return JsonResponse({'error': 'Please enter username and password.'}, status=400)

        result, error = _post_external_or_error(
            url_env='LOGIN_THROUGH_PASSWORD_URL',
            payload={
                'email': username_raw,
                'password': password,
                'system_name': SYSTEM_NAME,
            },
            failure_status=401,
            failure_default_message='Invalid username or password.',
        )
        if error:
            return error

        session_payload = {'email': username_raw}
        session_payload.update(result or {})
        raw_token, expires_at = create_signed_session(payload=session_payload)

        return JsonResponse(
            {
                'token': raw_token,
                'expires_at': expires_at.isoformat(),
                'user': {
                    'id': None,
                    'username': username_raw,
                },
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class ApiForgotPasswordView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        email = (payload.get('email') or '').strip()
        password = (payload.get('password') or '').strip()

        if not email or not password:
            return JsonResponse({'error': 'Please enter email and password.'}, status=400)

        result, error = _post_external_or_error(
            url_env='FORGET_PASSWORD_URL',
            payload={
                'email': email,
                'password': password,
                'system_name': SYSTEM_NAME,
            },
            failure_status=400,
            failure_default_message='Unable to reset password.',
        )
        if error:
            return error

        return JsonResponse({'ok': True, 'message': _external_success_message(result or {})})


@method_decorator(csrf_exempt, name='dispatch')
class ApiRegisterView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        display_name = (payload.get('display_name') or '').strip()
        email = (payload.get('email') or '').strip()
        phone_number = _normalize_phone(payload.get('phone_number') or '')
        password = (payload.get('password') or '').strip()

        if not display_name or not email or not phone_number or not password:
            return JsonResponse({'error': 'Please fill all required fields.'}, status=400)

        result, error = _post_external_or_error(
            url_env='REGISTER_URL',
            payload={
                'display_name': display_name,
                'email': email,
                'phone_number': phone_number,
                'password': password,
                'system_name': SYSTEM_NAME,
                'role': REGISTER_ROLE,
            },
            failure_status=400,
            failure_default_message='Unable to create account.',
        )
        if error:
            return error

        return JsonResponse({'ok': True, 'message': _external_success_message(result or {})})


@method_decorator(csrf_exempt, name='dispatch')
class ApiMeView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        session_payload = _get_session_payload(request)
        if session_payload is None:
            return JsonResponse({'error': 'Unauthorized'}, status=401)

        email = (session_payload.get('email') or '').strip() or None

        return JsonResponse(
            {
                'user': {
                    'id': None,
                    'username': email,
                },
                'member': {
                    'id': None,
                    'name': session_payload.get('display_name'),
                    'email': email,
                    'phone': session_payload.get('phone_number'),
                },
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class ApiLogoutView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        return JsonResponse({'ok': True})


@method_decorator(csrf_exempt, name='dispatch')
class ApiOtpRequestView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        channel = (payload.get('channel') or '').strip().lower()
        phone = _normalize_phone(payload.get('phone') or payload.get('username') or '')
        email = (payload.get('email') or payload.get('username') or '').strip()

        if channel not in {'whatsapp', 'email'}:
            return JsonResponse({'error': 'Invalid OTP channel.'}, status=400)

        if channel == 'whatsapp' and not phone:
            return JsonResponse({'error': 'Please enter mobile number.'}, status=400)
        if channel == 'email' and not email:
            return JsonResponse({'error': 'Please enter email id.'}, status=400)

        identifier = email if channel == 'email' else phone
        result, error = _post_external_or_error(
            url_env='SEND_OTP_URL',
            payload={
                'email': identifier,
                'type': channel,
                'system_name': SYSTEM_NAME,
            },
            failure_status=400,
            failure_default_message='Unable to request key',
        )
        if error:
            return error

        challenge_id, expires_at = create_signed_otp_challenge(email=identifier, channel=channel)
        return JsonResponse({'challenge_id': challenge_id, 'expires_at': expires_at.isoformat()})


@method_decorator(csrf_exempt, name='dispatch')
class ApiOtpVerifyView(View):
    def post(self, request: HttpRequest) -> JsonResponse:
        payload = _json_body(request)
        challenge_id = payload.get('challenge_id')
        otp = (payload.get('otp') or '').strip()

        if not challenge_id or not otp:
            return JsonResponse({'error': 'Please enter OTP.'}, status=400)

        try:
            otp_payload = load_signed_otp_challenge(str(challenge_id))
        except ExternalAuthError as exc:
            return JsonResponse({'error': str(exc)}, status=401)

        email = (otp_payload.get('email') or '').strip()
        result, error = _post_external_or_error(
            url_env='VERIFY_OTP_URL',
            payload={
                'email': email,
                'otp': otp,
                'system_name': SYSTEM_NAME,
            },
            failure_status=401,
            failure_default_message='Invalid or expired OTP.',
        )
        if error:
            return error

        session_payload = {'email': email}
        session_payload.update(result or {})
        raw_token, expires_at = create_signed_session(payload=session_payload)

        return JsonResponse(
            {
                'token': raw_token,
                'expires_at': expires_at.isoformat(),
                'user': {'id': None, 'username': email},
            }
        )


def _parse_iso_date(raw_value: str | None) -> date | None:
    value = (raw_value or '').strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _require_employee_session(request: HttpRequest) -> JsonResponse | None:
    if _get_session_payload(request) is None:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    return None


def _next_pk(model_cls, field_name: str) -> int:
    latest = model_cls.objects.order_by(f'-{field_name}').values_list(field_name, flat=True).first()
    return int(latest or 0) + 1


def _latest_ctc(emp_id: int) -> LegacyEmployeeCtcInfo | None:
    return (
        LegacyEmployeeCtcInfo.objects.filter(emp_id=emp_id)
        .order_by('-start_of_ctc', '-emp_ctc_id')
        .first()
    )


def _compliance_map(emp_id: int) -> dict[str, LegacyEmployeeComplianceTracker]:
    rows = LegacyEmployeeComplianceTracker.objects.filter(emp_id=emp_id)
    mapping: dict[str, LegacyEmployeeComplianceTracker] = {}
    for row in rows.order_by('-emp_compliance_tracker_id'):
        key = (row.comp_type or '').strip().lower()
        if key and key not in mapping:
            mapping[key] = row
    return mapping


def _latest_ctc_by_emp_ids(emp_ids: list[int]) -> dict[int, LegacyEmployeeCtcInfo]:
    mapping: dict[int, LegacyEmployeeCtcInfo] = {}
    if not emp_ids:
        return mapping
    rows = LegacyEmployeeCtcInfo.objects.filter(emp_id__in=emp_ids).order_by('emp_id', '-start_of_ctc', '-emp_ctc_id')
    for row in rows:
        if row.emp_id not in mapping:
            mapping[row.emp_id] = row
    return mapping


def _compliance_by_emp_ids(
    emp_ids: list[int],
) -> dict[int, dict[str, LegacyEmployeeComplianceTracker]]:
    mapping: dict[int, dict[str, LegacyEmployeeComplianceTracker]] = {}
    if not emp_ids:
        return mapping
    rows = LegacyEmployeeComplianceTracker.objects.filter(emp_id__in=emp_ids).order_by(
        'emp_id', '-emp_compliance_tracker_id'
    )
    for row in rows:
        emp_map = mapping.setdefault(row.emp_id, {})
        key = (row.comp_type or '').strip().lower()
        if key and key not in emp_map:
            emp_map[key] = row
    return mapping


def _serialize_master_employee(master: LegacyEmployeeMaster) -> dict:
    full_name = ' '.join(
        part for part in [master.first_name, master.middle_name, master.last_name] if part
    ).strip()
    latest_ctc = _latest_ctc(master.emp_id)
    comp = _compliance_map(master.emp_id)
    return {
        'id': master.emp_id,
        'emp_id': str(master.emp_id),
        'name': full_name,
        'designation': latest_ctc.ext_title if latest_ctc else '',
        'department': comp.get('department').status if comp.get('department') else '',
        'joining_date': master.start_date.isoformat() if master.start_date else None,
        'email': comp.get('email').status if comp.get('email') else '',
        'contact_number': comp.get('contact').status if comp.get('contact') else '',
        'is_active': master.end_date is None,
        'end_date': master.end_date.isoformat() if master.end_date else None,
    }


def _serialize_master_employee_with_maps(
    master: LegacyEmployeeMaster,
    latest_ctc_map: dict[int, LegacyEmployeeCtcInfo],
    compliance_map: dict[int, dict[str, LegacyEmployeeComplianceTracker]],
) -> dict:
    full_name = ' '.join(
        part for part in [master.first_name, master.middle_name, master.last_name] if part
    ).strip()
    latest_ctc = latest_ctc_map.get(master.emp_id)
    comp = compliance_map.get(master.emp_id, {})
    return {
        'id': master.emp_id,
        'emp_id': str(master.emp_id),
        'name': full_name,
        'designation': latest_ctc.ext_title if latest_ctc else '',
        'department': comp.get('department').status if comp.get('department') else '',
        'joining_date': master.start_date.isoformat() if master.start_date else None,
        'email': comp.get('email').status if comp.get('email') else '',
        'contact_number': comp.get('contact').status if comp.get('contact') else '',
        'is_active': master.end_date is None,
        'end_date': master.end_date.isoformat() if master.end_date else None,
    }


def _require_numeric_emp_id(raw_emp_id: str) -> int | None:
    value = (raw_emp_id or '').strip()
    if not value.isdigit():
        return None
    return int(value)


def _split_name(raw_name: str) -> tuple[str, str | None, str] | None:
    parts = [part for part in (raw_name or '').strip().split() if part]
    if len(parts) < 2:
        return None
    first_name = parts[0]
    last_name = parts[-1]
    middle_name = ' '.join(parts[1:-1]) or None
    return first_name, middle_name, last_name


def _upsert_compliance(emp_id: int, comp_type: str, status_value: str) -> None:
    normalized = (status_value or '').strip()
    if not normalized:
        return
    row = (
        LegacyEmployeeComplianceTracker.objects.filter(emp_id=emp_id, comp_type=comp_type)
        .order_by('-emp_compliance_tracker_id')
        .first()
    )
    if row:
        row.status = normalized
        row.save(update_fields=['status'])
        return
    LegacyEmployeeComplianceTracker.objects.create(
        emp_compliance_tracker_id=_next_pk(LegacyEmployeeComplianceTracker, 'emp_compliance_tracker_id'),
        emp_id=emp_id,
        comp_type=comp_type,
        status=normalized,
        doc_url='',
    )


@method_decorator(csrf_exempt, name='dispatch')
class EmployeesView(View):
    def get(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        employees = list(LegacyEmployeeMaster.objects.all().order_by('-emp_id'))
        emp_ids = [emp.emp_id for emp in employees]
        latest_ctc_map = _latest_ctc_by_emp_ids(emp_ids)
        compliance_map = _compliance_by_emp_ids(emp_ids)
        return JsonResponse(
            [_serialize_master_employee_with_maps(emp, latest_ctc_map, compliance_map) for emp in employees],
            safe=False,
        )

    def post(self, request: HttpRequest) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        payload = _json_body(request)
        required_fields = ['emp_id', 'name', 'designation', 'department', 'joining_date', 'email', 'contact_number']
        missing_fields = [field for field in required_fields if not (payload.get(field) or '').strip()]
        if missing_fields:
            return JsonResponse({'error': f'Missing fields: {", ".join(missing_fields)}'}, status=400)

        emp_id = _require_numeric_emp_id(payload.get('emp_id') or '')
        if emp_id is None:
            return JsonResponse({'error': 'Emp ID must be numeric for company master tables.'}, status=400)

        joining_date = _parse_iso_date(payload.get('joining_date'))
        if not joining_date:
            return JsonResponse({'error': 'Invalid joining_date. Use YYYY-MM-DD.'}, status=400)

        split = _split_name(payload.get('name') or '')
        if split is None:
            return JsonResponse({'error': 'Name must include at least first and last name.'}, status=400)
        first_name, middle_name, last_name = split

        try:
            with transaction.atomic():
                master = LegacyEmployeeMaster.objects.create(
                    emp_id=emp_id,
                    first_name=first_name,
                    middle_name=middle_name,
                    last_name=last_name,
                    start_date=joining_date,
                    end_date=None,
                )
                LegacyEmployeeCtcInfo.objects.create(
                    emp_ctc_id=_next_pk(LegacyEmployeeCtcInfo, 'emp_ctc_id'),
                    emp_id=emp_id,
                    int_title=(payload.get('department') or '').strip() or 'GENERAL',
                    ext_title=(payload.get('designation') or '').strip() or 'Employee',
                    main_level=1,
                    sub_level='A',
                    start_of_ctc=joining_date,
                    end_of_ctc=None,
                    ctc_amt=120000,
                )
                _upsert_compliance(emp_id, 'Department', (payload.get('department') or '').strip())
                _upsert_compliance(emp_id, 'Email', (payload.get('email') or '').strip())
                _upsert_compliance(emp_id, 'Contact', (payload.get('contact_number') or '').strip())
        except IntegrityError:
            return JsonResponse({'error': 'Emp ID already exists.'}, status=400)

        return JsonResponse(_serialize_master_employee(master), status=201)


@method_decorator(csrf_exempt, name='dispatch')
class EmployeeDetailView(View):
    def put(self, request: HttpRequest, employee_id: int) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        try:
            employee = LegacyEmployeeMaster.objects.get(pk=employee_id)
        except LegacyEmployeeMaster.DoesNotExist:
            return JsonResponse({'error': 'Employee not found.'}, status=404)

        payload = _json_body(request)
        if 'name' in payload:
            split = _split_name(payload.get('name') or '')
            if split is None:
                return JsonResponse({'error': 'Name must include at least first and last name.'}, status=400)
            employee.first_name, employee.middle_name, employee.last_name = split
            employee.save(update_fields=['first_name', 'middle_name', 'last_name'])

        if 'designation' in payload:
            designation = (payload.get('designation') or '').strip()
            if not designation:
                return JsonResponse({'error': 'designation cannot be empty.'}, status=400)
            current_ctc = _latest_ctc(employee.emp_id)
            if current_ctc:
                current_ctc.ext_title = designation
                current_ctc.save(update_fields=['ext_title'])
            else:
                LegacyEmployeeCtcInfo.objects.create(
                    emp_ctc_id=_next_pk(LegacyEmployeeCtcInfo, 'emp_ctc_id'),
                    emp_id=employee.emp_id,
                    int_title=(payload.get('department') or '').strip() or 'GENERAL',
                    ext_title=designation,
                    main_level=1,
                    sub_level='A',
                    start_of_ctc=employee.start_date,
                    end_of_ctc=None,
                    ctc_amt=120000,
                )

        if 'department' in payload:
            _upsert_compliance(employee.emp_id, 'Department', (payload.get('department') or '').strip())
        if 'email' in payload:
            _upsert_compliance(employee.emp_id, 'Email', (payload.get('email') or '').strip())
        if 'contact_number' in payload:
            _upsert_compliance(employee.emp_id, 'Contact', (payload.get('contact_number') or '').strip())

        return JsonResponse(_serialize_master_employee(employee))


@method_decorator(csrf_exempt, name='dispatch')
class EmployeeExitView(View):
    def post(self, request: HttpRequest, employee_id: int) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        try:
            employee = LegacyEmployeeMaster.objects.get(pk=employee_id)
        except LegacyEmployeeMaster.DoesNotExist:
            return JsonResponse({'error': 'Employee not found.'}, status=404)

        payload = _json_body(request)
        end_date = _parse_iso_date(payload.get('end_date'))
        if not end_date:
            return JsonResponse({'error': 'Invalid or missing end_date. Use YYYY-MM-DD.'}, status=400)

        if employee.start_date and end_date < employee.start_date:
            return JsonResponse({'error': 'end_date cannot be before joining_date.'}, status=400)

        employee.end_date = end_date
        employee.save(update_fields=['end_date'])
        return JsonResponse(_serialize_master_employee(employee))


def _as_iso(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


@method_decorator(csrf_exempt, name='dispatch')
class EmployeeProfileView(View):
    def get(self, request: HttpRequest, employee_id: str) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        base_emp_id = None
        personal = None

        if employee_id.isdigit():
            master = LegacyEmployeeMaster.objects.filter(emp_id=int(employee_id)).first()
            if master:
                comp = _compliance_map(master.emp_id)
                full_name = ' '.join(
                    part for part in [master.first_name, master.middle_name, master.last_name] if part
                ).strip()
                latest_ctc = (
                    LegacyEmployeeCtcInfo.objects.filter(emp_id=master.emp_id)
                    .order_by('-start_of_ctc', '-emp_ctc_id')
                    .first()
                )
                personal = {
                    'name': full_name or None,
                    'emp_id': str(master.emp_id),
                    'designation': latest_ctc.ext_title if latest_ctc else None,
                    'department': comp.get('department').status if comp.get('department') else None,
                    'joining_date': _as_iso(master.start_date),
                    'email': comp.get('email').status if comp.get('email') else None,
                    'contact_number': comp.get('contact').status if comp.get('contact') else None,
                    'status': 'Exited' if master.end_date else 'Active',
                }
                base_emp_id = master.emp_id

        if personal is None:
            return JsonResponse({'error': 'Employee profile not found.'}, status=404)

        bank_info = None
        reg_info = None
        compliance_rows = []
        ctc_rows = []
        if base_emp_id is not None:
            bank_info = (
                LegacyEmployeeBankInfo.objects.filter(emp_id=base_emp_id)
                .order_by('-emp_bank_id')
                .first()
            )
            reg_info = (
                LegacyEmployeeRegInfo.objects.filter(emp_id=base_emp_id)
                .order_by('-emp_reg_info_id')
                .first()
            )
            compliance_rows = list(
                LegacyEmployeeComplianceTracker.objects.filter(emp_id=base_emp_id).order_by(
                    '-emp_compliance_tracker_id'
                )
            )
            ctc_rows = list(
                LegacyEmployeeCtcInfo.objects.filter(emp_id=base_emp_id).order_by('start_of_ctc')
            )

        profile = {
            'personal_details': personal,
            'bank_details': {
                'account_number': bank_info.bank_acct_no if bank_info else None,
                'bank_name': bank_info.bank_name if bank_info else None,
                'ifsc_code': bank_info.ifsc_code if bank_info else None,
                'branch_name': bank_info.branch_name if bank_info else None,
            },
            'compliance_ids': {
                'pf_number': reg_info.uan_epf_acctno if reg_info else None,
                'esi_number': reg_info.esi if reg_info else None,
                'pan': reg_info.pan if reg_info else None,
                'aadhaar': reg_info.aadhaar if reg_info else None,
                'tracker': [
                    {
                        'type': row.comp_type,
                        'status': row.status,
                        'doc_url': row.doc_url,
                    }
                    for row in compliance_rows
                ],
            },
            'ctc_timeline': [
                {
                    'effective_from': _as_iso(row.start_of_ctc),
                    'effective_to': _as_iso(row.end_of_ctc),
                    'internal_title': row.int_title,
                    'external_title': row.ext_title,
                    'main_level': row.main_level,
                    'sub_level': row.sub_level,
                    'ctc_amount': str(row.ctc_amt) if row.ctc_amt is not None else None,
                }
                for row in ctc_rows
            ],
        }

        return JsonResponse(profile)


@method_decorator(csrf_exempt, name='dispatch')
class EmployeeBankAccountView(View):
    def get(self, request: HttpRequest, employee_id: int) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        row = (
            LegacyEmployeeBankInfo.objects.filter(emp_id=employee_id)
            .order_by('-emp_bank_id')
            .first()
        )
        if row is None:
            return JsonResponse(
                {
                    'emp_id': employee_id,
                    'account_number': '',
                    'bank_name': '',
                    'ifsc_code': '',
                    'branch_name': '',
                }
            )

        return JsonResponse(
            {
                'emp_id': employee_id,
                'account_number': row.bank_acct_no or '',
                'bank_name': row.bank_name or '',
                'ifsc_code': row.ifsc_code or '',
                'branch_name': row.branch_name or '',
            }
        )

    def put(self, request: HttpRequest, employee_id: int) -> JsonResponse:
        unauthorized = _require_employee_session(request)
        if unauthorized:
            return unauthorized

        payload = _json_body(request)
        account_number = (payload.get('account_number') or '').strip()
        bank_name = (payload.get('bank_name') or '').strip()
        ifsc_code = (payload.get('ifsc_code') or '').strip()
        branch_name = (payload.get('branch_name') or '').strip()

        if not account_number or not bank_name or not ifsc_code or not branch_name:
            return JsonResponse({'error': 'All bank account fields are required.'}, status=400)

        row = (
            LegacyEmployeeBankInfo.objects.filter(emp_id=employee_id)
            .order_by('-emp_bank_id')
            .first()
        )
        if row:
            row.bank_acct_no = account_number
            row.bank_name = bank_name
            row.ifsc_code = ifsc_code
            row.branch_name = branch_name
            row.save(update_fields=['bank_acct_no', 'bank_name', 'ifsc_code', 'branch_name'])
        else:
            row = LegacyEmployeeBankInfo.objects.create(
                emp_bank_id=_next_pk(LegacyEmployeeBankInfo, 'emp_bank_id'),
                emp_id=employee_id,
                bank_acct_no=account_number,
                ifsc_code=ifsc_code,
                branch_name=branch_name,
                bank_name=bank_name,
            )

        return JsonResponse(
            {
                'emp_id': employee_id,
                'account_number': row.bank_acct_no,
                'bank_name': row.bank_name,
                'ifsc_code': row.ifsc_code,
                'branch_name': row.branch_name,
            }
        )
