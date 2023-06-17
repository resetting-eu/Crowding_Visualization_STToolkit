from parsimonious.grammar import Grammar
from parsimonious.nodes import NodeVisitor

def add_derived_metrics(res, derived_metrics):
    for derived_metric in derived_metrics:
        add_derived_metric(res, derived_metric, derived_metrics[derived_metric])

def add_derived_metric(res, derived_metric_name, derived_metric_expression):
    expr = derived_metric_expression.replace(" ", "") # remove whitespace
    ast = grammar.parse(expr)
    metrics = get_referenced_metrics(ast)
    if len(metrics) == 0: # constant expression
        add_constant_expression(res, derived_metric_name, calc(ast, {}))
    else:
        res["values"][derived_metric_name] = {}
        for location in res["values"][metrics[0]]:
            if location_in_all_metrics(location, res, metrics):
                res["values"][derived_metric_name][location] = location_values(location, res, metrics, ast)   

def add_constant_expression(res, metric_name, value):
    timestamps_size = len(res["timestamps"])
    res["values"][metric_name] = {}
    for metric in res["values"]:
        for location in res["values"][metric]:
            res["values"][metric_name][location] = value * timestamps_size

def location_in_all_metrics(location, res, metrics):
    for metric in metrics:
        if location not in res["values"][metric]:
            return False
    return True

def location_values(location, res, metrics, ast):
    values = []
    for i in range(len(res["values"][metrics[0]][location])):
        id_values = {}
        for metric in metrics:
            id_values[metric] = res["values"][metric][location][i]
        value = calc(ast, id_values)
        values.append(value)
    return values

grammar = Grammar(
    r"""
    sum = product plus_or_minus?
    plus_or_minus = ("+" / "-") sum
    product = atom mult_or_div?
    mult_or_div = ("*" / "/") product
    atom = paren_expr / identifier / constant
    paren_expr = "(" sum ")"
    identifier = ~r"[A-Z_][A-Z_0-9]*"i
    constant = int / float
    float = ~r"[0-9]*\.[0-9]+"
    int = ~r"[0-9]+"
    """
)

class ListIdentifiersVisitor(NodeVisitor):
    _identifiers = set()

    def visit_identifier(self, node, visited_children):
        identifier = node.match.group()
        self._identifiers.add(identifier)

    def generic_visit(self, node, visited_children):
        # ignore non-identifier nodes
        pass

    def identifiers(self):
        return list(self._identifiers)

class CalcExpressionVisitor(NodeVisitor):
    def __init__(self, id_values):
        self._id_values = id_values

    def visit_sum(self, node, visited_children):
        res = visited_children[0]
        if visited_children[1]:
            operator, right = visited_children[1]
            res = res + right if operator == "+" else res - right
        return res
    
    def visit_plus_or_minus(self, node, visited_children):
        operator = node.children[0].text
        return [operator, visited_children[1]]

    def visit_product(self, node, visited_children):
        res = visited_children[0]
        if visited_children[1]:
            operator, right = visited_children[1]
            res = res * right if operator == "*" else res / right
        return res

    def visit_mult_or_div(self, node, visited_children): #NOSONAR
        operator = node.children[0].text
        return [operator, visited_children[1]]
        
    def visit_atom(self, node, visited_children):
        return visited_children[0]
    
    def visit_paren_expr(self, node, visited_children):
        assert len(visited_children) == 3
        return visited_children[1]

    def visit_identifier(self, node, visited_children):
        identifier = node.match.group()
        return self._id_values[identifier]
    
    def visit_constant(self, node, visited_children):
        return visited_children[0]

    def visit_float(self, node, visited_children):
        return float(node.match.group())
    
    def visit_int(self, node, visited_children):
        return int(node.match.group())
    
    def generic_visit(self, node, visited_children):
        if len(visited_children) > 0:
            return visited_children[0]
        else:
            return None


def get_referenced_metrics(ast):
    ids_visitor = ListIdentifiersVisitor()
    ids_visitor.visit(ast)
    return ids_visitor.identifiers()

def calc(ast, id_values):
    visitor = CalcExpressionVisitor(id_values)
    return visitor.visit(ast)
