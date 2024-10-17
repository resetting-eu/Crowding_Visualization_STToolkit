from ..forecasting.polling_job import evaluate_models

def generate_handler(parameters):
    result = evaluate_models(parameters)
    def prediction_evaluation_handler(_):
        return result
    return prediction_evaluation_handler
