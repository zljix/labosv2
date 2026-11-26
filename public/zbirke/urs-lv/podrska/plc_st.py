# Izvrsavanje nastavnog podskupa jezika Structured Text za LV16.
# Svaki PLC ciklus procita ulaze, izvede naredbe redom i osvjezi izlaze.

def tokens(text):
    result = []
    i, line = 0, 1
    while i < len(text):
        c = text[i]
        if c.isspace():
            line += c == '\n'
            i += 1
            continue
        if text[i:i + 2] == '(*':
            end = text.find('*)', i + 2)
            if end < 0:
                raise ValueError('Redak %d: nedostaje kraj komentara *).' % line)
            line += text[i:end + 2].count('\n')
            i = end + 2
            continue
        if text[i:i + 2] == '//':
            end = text.find('\n', i)
            i = len(text) if end < 0 else end
            continue
        start = i
        i += 1
        if c.isalpha() or c == '_' or c.isdigit():
            while i < len(text) and (text[i].isalpha() or text[i].isdigit() or text[i] in '_#'):
                i += 1
        elif text[start:start + 2] in (':=', '<>', '<=', '>='):
            i += 1
        elif c not in '(),;:.=<>':
            raise ValueError('Redak %d: nepoznat znak %s.' % (line, c))
        result.append((text[start:i].upper(), line))
    result.append(('', line))
    return result


def duration(token):
    if token.startswith('T#') or token.startswith('TIME#'):
        value = token.split('#')[1]
        if not value:
            raise ValueError('Neispravno vrijeme ' + token)
        scales = (('MS', 1), ('S', 1000), ('M', 60000), ('H', 3600000))
        total = 0
        while value:
            i = 0
            while i < len(value) and value[i].isdigit():
                i += 1
            for unit, scale in scales:
                if i and value[i:].startswith(unit):
                    total += int(value[:i]) * scale
                    value = value[i + len(unit):]
                    break
            else:
                raise ValueError('Neispravno vrijeme ' + token)
        return total
    return None


class Parser:
    def __init__(self, text, types):
        self.items = tokens(text)
        self.pos = 0
        self.types = types

    def peek(self):
        return self.items[self.pos][0]

    def fail(self, message):
        raise ValueError('Redak %d: %s' % (self.items[self.pos][1], message))

    def take(self):
        token = self.peek()
        if not token:
            self.fail('neocekivan kraj teksta.')
        self.pos += 1
        return token

    def accept(self, token):
        if self.peek() == token:
            self.pos += 1
            return True
        return False

    def need(self, token):
        if not self.accept(token):
            self.fail('ocekivano ' + token + ', procitano ' + (self.peek() or 'kraj') + '.')

    def name(self):
        token = self.peek()
        if not token or not (token[0].isalpha() or token[0] == '_'):
            self.fail('ocekivano ime varijable.')
        return self.take()

    def declarations(self):
        values = {}
        if self.accept('PROGRAM'):
            self.name()
            self.accept(';')
        while self.peek() in ('VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_TEMP'):
            block = self.take()
            if block == 'VAR_TEMP':
                self.fail('za memoriju ciklusa upotrijebi VAR.')
            while self.peek() != 'END_VAR':
                names = [self.name()]
                while self.accept(','):
                    names.append(self.name())
                self.need(':')
                kind = self.take()
                if kind not in ('BOOL', 'TON', 'TIME'):
                    self.fail('vjezba podrzava tipove BOOL, TIME i TON.')
                value = False if kind == 'BOOL' else 0
                if self.accept(':='):
                    literal = self.take()
                    if kind == 'BOOL' and literal in ('TRUE', 'FALSE'):
                        value = literal == 'TRUE'
                    elif kind == 'TIME' and duration(literal) is not None:
                        value = duration(literal)
                    else:
                        self.fail('neispravna pocetna vrijednost za ' + kind)
                self.need(';')
                for name in names:
                    if name in self.types:
                        self.fail('ponovljeno ime ' + name)
                    self.types[name] = kind
                    if kind == 'TON':
                        values[name + '.Q'] = False
                        values[name + '.ET'] = 0
                    else:
                        values[name] = value
            self.take()
            self.accept(';')
        if self.peek():
            self.fail('ocekivano VAR ili kraj deklaracija.')
        return values

    def expression(self, minimum=0):
        if self.accept('NOT'):
            left = ('not', self.expression(5))
        elif self.accept('('):
            left = self.expression()
            self.need(')')
        else:
            name = self.take()
            value = duration(name)
            if name in ('TRUE', 'FALSE'):
                left = ('value', name == 'TRUE')
            elif value is not None:
                left = ('value', value)
            elif name.isdigit():
                left = ('value', int(name))
            else:
                kind = self.types.get(name)
                if kind == 'TON':
                    self.need('.')
                    field = self.take()
                    if field not in ('Q', 'ET'):
                        self.fail('izlazi brojača vremena su Q i ET.')
                    name += '.' + field
                elif not kind:
                    self.fail('nepoznata varijabla ' + name)
                left = ('read', name)
        priority = {'OR':1, 'XOR':2, 'AND':3, '=':4, '<>':4, '<':4, '>':4, '<=':4, '>=':4}
        while priority.get(self.peek(), -1) >= minimum:
            op = self.take()
            right = self.expression(priority[op] + 1)
            left = (op, left, right)
        return left

    def statements(self):
        result = []
        while self.peek() not in ('', 'ELSIF', 'ELSE', 'END_IF', 'END_PROGRAM'):
            if self.accept('IF'):
                branches = []
                while True:
                    test = self.expression()
                    self.need('THEN')
                    branches.append((test, self.statements()))
                    if not self.accept('ELSIF'):
                        break
                fallback = self.statements() if self.accept('ELSE') else []
                self.need('END_IF')
                result.append(('if', branches, fallback))
            else:
                name = self.name()
                if name not in self.types:
                    self.fail('nedostaje deklaracija za ' + name)
                if self.types[name] == 'TON':
                    self.need('(')
                    args = {}
                    while True:
                        param = self.name()
                        if param not in ('IN', 'PT') or param in args:
                            self.fail('TON prihvaca ulaze IN i PT.')
                        self.need(':=')
                        args[param] = self.expression()
                        if not self.accept(','):
                            break
                    self.need(')')
                    if len(args) != 2:
                        self.fail('zadaj IN i PT za TON.')
                    result.append(('timer', name, args['IN'], args['PT']))
                else:
                    self.need(':=')
                    result.append(('set', name, self.expression()))
            self.need(';')
        return result


def evaluate(tree, values):
    op, arg = tree[0], tree[1]
    if op == 'value': return arg
    if op == 'read': return values[arg]
    a = evaluate(arg, values)
    if op == 'not': return not a
    b = evaluate(tree[2], values)
    if op == 'AND': return bool(a and b)
    if op == 'OR': return bool(a or b)
    if op == 'XOR': return bool(a) != bool(b)
    if op == '=': return a == b
    if op == '<>': return a != b
    if op == '<': return a < b
    if op == '>': return a > b
    if op == '<=': return a <= b
    return a >= b


class Plc:
    def __init__(self, declarations, program):
        self.types = {}
        self.values = Parser(declarations, self.types).declarations()
        for name in ('START', 'STOPOK', 'PROTECTIONOK', 'MOTOR'):
            if self.types.get(name) != 'BOOL':
                raise ValueError('U deklaracijama je potreban ' + name + ' : BOOL.')
        parser = Parser(program, self.types)
        self.code = parser.statements()
        parser.accept('END_PROGRAM')
        parser.accept(';')
        if parser.peek():
            parser.fail('neocekivana naredba ' + parser.peek())
        self.started = {}

    def execute(self, block, now):
        v = self.values
        for cmd in block:
            if cmd[0] == 'set':
                v[cmd[1]] = evaluate(cmd[2], v)
            elif cmd[0] == 'if':
                for condition, then in cmd[1]:
                    if evaluate(condition, v):
                        self.execute(then, now)
                        break
                else:
                    self.execute(cmd[2], now)
            else:
                name = cmd[1]
                active, preset = evaluate(cmd[2], v), evaluate(cmd[3], v)
                if active:
                    if name not in self.started:
                        self.started[name] = now
                    elapsed = max(0, now - self.started[name])
                    v[name + '.ET'] = min(elapsed, preset)
                    v[name + '.Q'] = elapsed >= preset
                else:
                    self.started.pop(name, None)
                    v[name + '.ET'], v[name + '.Q'] = 0, False

    def scan(self, inputs, now):
        for name in inputs:
            if name in self.types:
                self.values[name] = inputs[name]
        self.execute(self.code, now)
        return self.values
