import copy
import sys
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler

class LSTM(nn.Module):
    def __init__(self,
                 hidden_size,
                 in_size = 1,
                 out_size = 1,
                 dropout_prob = 0.1):
        super(LSTM, self).__init__()
        self.lstm = nn.LSTM(
            input_size = in_size,
            hidden_size = hidden_size,
            batch_first = True)
        self.fc = nn.Linear(hidden_size, out_size)
        self.dropout = nn.Dropout(p=dropout_prob)

    def forward(self, x, h = None):
        self.lstm.flatten_parameters()
        out, h = self.lstm(x, h)
        out = self.dropout(out)
        last_hidden_states = out[:, -1]
        out = self.fc(last_hidden_states)
        return out, h

    def enable_dropout(self):
        for m in self.modules():
            if m.__class__.__name__.startswith('Dropout'):
                m.train()

# TODO optionally enable CUDA?
def forecast(xs, total_steps_to_forecast, n_simulations, parameters):
    n_timestamps = len(xs)
    train_until = int(n_timestamps * 0.8)
    xs = np.array(xs).reshape(-1,1)
    scaler = MinMaxScaler()
    scaled_xs = scaler.fit_transform(xs)
    scaled_xs.reshape(-1)
    scaled_train = torch.tensor(data = scaled_xs[:train_until]).view(train_until,1,1).float()
    scaled_val = torch.tensor(data = scaled_xs[train_until:]).view(n_timestamps-train_until,1,1).float()
    scaled_all = torch.tensor(data = scaled_xs).view(n_timestamps,1,1).float()
    
    hidden_size = parameters["hidden_size"]
    learning_rate = parameters["learning_rate"]
    training_epochs = parameters["training_epochs"]
    model = train(scaled_train, scaled_val, hidden_size, learning_rate, training_epochs)

    model.eval()
    model.enable_dropout()
    with torch.no_grad():
        simulated_forecasts = np.zeros((n_simulations, total_steps_to_forecast))
        for simulation in range(n_simulations):
            _, h_list = model(scaled_val)
            # warm hidden and cell state
            h = tuple([(h[-1, -1, :]).unsqueeze(-2).unsqueeze(-2) for h in h_list])

            for step in range(total_steps_to_forecast):
                y_new, h = model(scaled_all[step].unsqueeze(0), h)
                unscaled = scaler.inverse_transform(
                    np.array(y_new.item()).reshape(-1, 1))[0][0]
                simulated_forecasts[simulation, step] = unscaled

    # XXX duplicated from SARIMA
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


def train(scaled_train, scaled_val, hidden_size, learning_rate, training_epochs):
    model = LSTM(hidden_size = hidden_size)
    model.train()

    optimizer = torch.optim.Adam(params = model.parameters(), lr = learning_rate)
    mse_loss = torch.nn.MSELoss()

    best_model = None
    min_val_loss = sys.maxsize

    training_loss = []
    validation_loss = []

    scaled_train_2d = scaled_train.squeeze(2)
    scaled_val_2d = scaled_val.squeeze(2)

    for _ in range(training_epochs):

        prediction, _ = model(scaled_train)
        loss = mse_loss(prediction, scaled_train_2d)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        val_prediction, _ = model(scaled_val)
        val_loss = mse_loss(val_prediction, scaled_val_2d)

        training_loss.append(loss.item())
        validation_loss.append(val_loss.item())

        if val_loss.item() < min_val_loss:
            best_model = copy.deepcopy(model)
            min_val_loss = val_loss.item()

    return best_model
