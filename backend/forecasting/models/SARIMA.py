from statsmodels.tsa.statespace.sarimax import SARIMAX
import numpy as np

def forecast(xs, total_steps_to_forecast, n_simulations, parameters):
    seasonality = parameters["seasonality"]

    model = SARIMAX(xs,
                    order=(1, 1, 1),
                    seasonal_order=(1, 1, 1, seasonality),
                    enforce_stationarity=False,
                    enforce_invertibility=False)

    model_fit = model.fit(disp=False)

    # Generate simulated forecasts
    simulated_forecasts = np.zeros((n_simulations, total_steps_to_forecast))

    for i in range(n_simulations):
        simulated_forecasts[i, :] = model_fit.simulate(total_steps_to_forecast, anchor='end', repetitions=1).reshape(-1)

    # Calculate quartiles for each forecasted step
    quartiles = np.percentile(simulated_forecasts, [0, 25, 50, 75, 100], axis=0)
    q0 = quartiles[0, :]
    q1 = quartiles[1, :]
    q2 = quartiles[2, :]
    q3 = quartiles[3, :]
    q4 = quartiles[4, :]

    res = []
    for i in range(total_steps_to_forecast):
        l = [q0[i], q1[i], q2[i], q3[i], q4[i]]
        for j in range(len(l)):
            if l[j] < 0:
                l[j] = 0.0
        res.append(l)
    
    return res
