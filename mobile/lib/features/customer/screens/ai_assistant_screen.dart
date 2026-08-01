import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../providers/auth_provider.dart';
import '../../../services/egov_ai_service.dart';
import '../../../theme/app_theme.dart';

final egovAiServiceProvider = Provider<EgovAiService>((ref) {
  return EgovAiService(ref.watch(authServiceProvider));
});

class _ChatTurn {
  _ChatTurn({required this.fromUser, required this.text});
  final bool fromUser;
  final String text;
}

class AiAssistantScreen extends ConsumerStatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  ConsumerState<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends ConsumerState<AiAssistantScreen> {
  final _input = TextEditingController();
  final _turns = <_ChatTurn>[
    _ChatTurn(
      fromUser: false,
      text:
          'I help with EHelp navigation, program details & coverage, dates, '
          'disbursement queue slots/locations, and your application status. '
          'Ask “Tell me about [program]”, “What queue slots are open?”, or “What’s my status?” '
          'I cannot create applications or book slots, and I will not answer unrelated topics. '
          'Use Report below for aid, account, or mobile-app issues.',
    ),
  ];
  var _sending = false;
  String? _mode;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final prompt = _input.text.trim();
    if (prompt.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _turns.add(_ChatTurn(fromUser: true, text: prompt));
      _input.clear();
    });
    try {
      final result =
          await ref.read(egovAiServiceProvider).ask(prompt: prompt);
      if (!mounted) return;
      setState(() {
        _mode = result.mode;
        _turns.add(_ChatTurn(fromUser: false, text: result.answer));
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _turns.add(_ChatTurn(fromUser: false, text: 'Sorry: $e'));
      });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('eGov AI Assistant'),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/customer/report'),
            icon: const Icon(Icons.report_problem_outlined, size: 18),
            label: const Text('Report'),
          ),
          if (_mode != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Text(
                  _mode!,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Material(
            color: AppColors.secondary,
            child: InkWell(
              onTap: () => context.push('/customer/report'),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    const Icon(
                      Icons.report_problem_outlined,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Report a problem (aid, account, or mobile app)',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Icon(Icons.chevron_right, color: AppColors.muted),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _turns.length,
              itemBuilder: (context, index) {
                final turn = _turns[index];
                return Align(
                  alignment: turn.fromUser
                      ? Alignment.centerRight
                      : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.sizeOf(context).width * 0.85,
                    ),
                    decoration: BoxDecoration(
                      color: turn.fromUser
                          ? AppColors.primary.withValues(alpha: 0.12)
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.muted.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(turn.text),
                  ),
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'Ask how to navigate EHelp…',
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
